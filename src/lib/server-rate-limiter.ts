import admin from '@/lib/firebase-admin';
import { checkRateLimit, getRateLimitStatus } from '@/lib/rate-limiter';
import { checkDistributedRateLimit, getDistributedRateLimitStatus } from '@/lib/distributed-rate-limiter';
import { normalizeTimezoneOffsetMinutes } from '@/lib/usage-limits';

export interface ServerRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  scope: string;
  timezoneOffsetMinutes?: number;
}

export interface ServerRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
}

export interface ServerRateLimitReservationResult extends ServerRateLimitResult {
  reservationId?: string;
  replayed?: boolean;
}

export interface ServerRateLimitStatus {
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
}

interface RateLimitDoc {
  count: number;
  windowStart: admin.firestore.Timestamp;
  reservations?: Record<string, number>;
  confirmations?: Record<string, number>;
}

const COLLECTION = 'rateLimits';
const STRICT_PROD_RATE_LIMIT_BACKEND =
  process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_RATE_LIMIT_FALLBACK !== '1';

function getCurrentWindow(config: ServerRateLimitConfig) {
  const now = Date.now();
  const offsetMinutes = normalizeTimezoneOffsetMinutes(config.timezoneOffsetMinutes);
  const offsetMs = offsetMinutes * 60 * 1000;
  const shiftedNow = now - offsetMs;
  const windowStartMs = shiftedNow - (shiftedNow % config.windowMs) + offsetMs;
  const resetAt = new Date(windowStartMs + config.windowMs);
  return { now, windowStartMs, resetAt };
}

function cleanMapByMinTs(map: Record<string, number> | undefined, minTs: number) {
  if (!map || typeof map !== 'object') return {} as Record<string, number>;

  const cleaned: Record<string, number> = {};
  for (const [key, ts] of Object.entries(map)) {
    if (Number.isFinite(ts) && ts >= minTs) {
      cleaned[key] = ts;
    }
  }
  return cleaned;
}

function cleanReservations(map: Record<string, number> | undefined, nowMs: number) {
  if (!map || typeof map !== 'object') return {} as Record<string, number>;

  const cleaned: Record<string, number> = {};
  for (const [key, expiresAtMs] of Object.entries(map)) {
    if (Number.isFinite(expiresAtMs) && expiresAtMs > nowMs) {
      cleaned[key] = expiresAtMs;
    }
  }
  return cleaned;
}

function isSameWindow(data: RateLimitDoc | undefined, windowStartMs: number): boolean {
  if (!data?.windowStart) return false;
  return data.windowStart.toMillis() === windowStartMs;
}

function buildRateLimitRef(subject: string, scope: string) {
  const db = admin.firestore();
  const docId = `${scope}:${subject}`;
  return db.collection(COLLECTION).doc(docId);
}

export async function reserveServerRateLimit(
  subject: string,
  config: ServerRateLimitConfig,
  reservationId: string,
  options?: { reservationTtlMs?: number }
): Promise<ServerRateLimitReservationResult> {
  const { now, windowStartMs, resetAt } = getCurrentWindow(config);
  const reservationTtlMs = Math.max(1_000, options?.reservationTtlMs ?? 5 * 60_000);

  try {
    const db = admin.firestore();
    const ref = buildRateLimitRef(subject, config.scope);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existingData = (snap.exists ? (snap.data() as RateLimitDoc) : undefined);

      const baseCount = isSameWindow(existingData, windowStartMs)
        ? Math.max(0, existingData?.count || 0)
        : 0;
      const reservations = isSameWindow(existingData, windowStartMs)
        ? cleanReservations(existingData?.reservations, now)
        : {};
      const confirmations = isSameWindow(existingData, windowStartMs)
        ? cleanMapByMinTs(existingData?.confirmations, windowStartMs)
        : {};

      if (confirmations[reservationId]) {
        tx.set(ref, {
          count: baseCount,
          windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
          reservations,
          confirmations,
        }, { merge: true });

        return {
          allowed: true,
          remaining: Math.max(0, config.maxRequests - baseCount),
          resetAt,
          reservationId,
          replayed: true,
        };
      }

      if (reservations[reservationId]) {
        tx.set(ref, {
          count: baseCount,
          windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
          reservations,
          confirmations,
        }, { merge: true });

        return {
          allowed: true,
          remaining: Math.max(0, config.maxRequests - baseCount),
          resetAt,
          reservationId,
          replayed: true,
        };
      }

      const activeReservations = Object.keys(reservations).length;
      if (baseCount + activeReservations >= config.maxRequests) {
        const secondsRemaining = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
        tx.set(ref, {
          count: baseCount,
          windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
          reservations,
          confirmations,
        }, { merge: true });
        return {
          allowed: false,
          remaining: Math.max(0, config.maxRequests - baseCount),
          resetAt,
          message: `Daily limit reached. Try again in ${secondsRemaining} seconds.`,
        };
      }

      reservations[reservationId] = now + reservationTtlMs;
      tx.set(ref, {
        count: baseCount,
        windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
        reservations,
        confirmations,
      }, { merge: true });

      return {
        allowed: true,
        remaining: Math.max(0, config.maxRequests - baseCount),
        resetAt,
        reservationId,
      };
    });
  } catch {
    try {
      const fallback = getRateLimitStatus(`${config.scope}:${subject}`, {
        windowMs: config.windowMs,
        maxRequests: config.maxRequests,
      });

      return {
        allowed: fallback.remaining > 0,
        remaining: fallback.remaining,
        resetAt: new Date(fallback.resetTime),
        reservationId,
        ...(fallback.remaining > 0
          ? {}
          : {
              message: `Daily limit reached. Try again in ${Math.max(1, Math.ceil((fallback.resetTime - now) / 1000))} seconds.`,
            }),
      };
    } catch {
      // Continue to strict fallback handling below.
    }

    if (STRICT_PROD_RATE_LIMIT_BACKEND) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        message: 'Rate limit service is temporarily unavailable. Please retry shortly.',
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      message: 'Rate limit service is temporarily unavailable. Please retry shortly.',
    };
  }
}

export async function confirmServerRateLimit(
  subject: string,
  config: ServerRateLimitConfig,
  reservationId: string
): Promise<ServerRateLimitStatus> {
  const { windowStartMs, resetAt } = getCurrentWindow(config);

  try {
    const db = admin.firestore();
    const ref = buildRateLimitRef(subject, config.scope);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existingData = (snap.exists ? (snap.data() as RateLimitDoc) : undefined);

      const baseCount = isSameWindow(existingData, windowStartMs)
        ? Math.max(0, existingData?.count || 0)
        : 0;
      const reservations = isSameWindow(existingData, windowStartMs)
        ? cleanReservations(existingData?.reservations, Date.now())
        : {};
      const confirmations = isSameWindow(existingData, windowStartMs)
        ? cleanMapByMinTs(existingData?.confirmations, windowStartMs)
        : {};

      if (!confirmations[reservationId]) {
        if (reservations[reservationId]) {
          delete reservations[reservationId];
          confirmations[reservationId] = Date.now();
          const nextCount = Math.min(config.maxRequests, baseCount + 1);
          tx.set(ref, {
            count: nextCount,
            windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
            reservations,
            confirmations,
          }, { merge: true });
          return {
            limit: config.maxRequests,
            used: nextCount,
            remaining: Math.max(0, config.maxRequests - nextCount),
            resetAt,
          };
        }
      }

      const used = Math.max(0, Math.min(baseCount, config.maxRequests));
      tx.set(ref, {
        count: used,
        windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
        reservations,
        confirmations,
      }, { merge: true });

      return {
        limit: config.maxRequests,
        used,
        remaining: Math.max(0, config.maxRequests - used),
        resetAt,
      };
    });
  } catch {
    const fallback = checkRateLimit(`${config.scope}:${subject}`, {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
    });

    return {
      limit: fallback.limit,
      used: Math.max(0, fallback.limit - fallback.remaining),
      remaining: fallback.remaining,
      resetAt: new Date(fallback.resetTime),
    };
  }
}

export async function releaseServerRateLimit(
  subject: string,
  config: ServerRateLimitConfig,
  reservationId: string
): Promise<void> {
  const { windowStartMs } = getCurrentWindow(config);

  try {
    const db = admin.firestore();
    const ref = buildRateLimitRef(subject, config.scope);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;

      const data = snap.data() as RateLimitDoc;
      const inWindow = isSameWindow(data, windowStartMs);
      const reservations = inWindow
        ? cleanReservations(data.reservations, Date.now())
        : {};
      const confirmations = inWindow
        ? cleanMapByMinTs(data.confirmations, windowStartMs)
        : {};

      if (!reservations[reservationId]) {
        return;
      }

      delete reservations[reservationId];
      tx.set(ref, {
        count: Math.max(0, data.count || 0),
        windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
        reservations,
        confirmations,
      }, { merge: true });
    });
  } catch {
    // Best effort release. In strict production mode, reservation TTL still prevents indefinite lockout.
  }
}

export async function checkServerRateLimit(
  subject: string,
  config: ServerRateLimitConfig
): Promise<ServerRateLimitResult> {
  const { now, windowStartMs, resetAt } = getCurrentWindow(config);

  const distributedResult = await checkDistributedRateLimit(subject, {
    scope: config.scope,
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
    timezoneOffsetMinutes: config.timezoneOffsetMinutes,
  });
  if (distributedResult) {
    return distributedResult;
  }

  try {
    const db = admin.firestore();
    const docId = `${config.scope}:${subject}`;
    const ref = db.collection(COLLECTION).doc(docId);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists) {
        tx.set(ref, {
          count: 1,
          windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
        });
        return { allowed: true, remaining: config.maxRequests - 1, resetAt };
      }

      const data = snap.data() as RateLimitDoc;
      
      // Safety check: if windowStart is missing or invalid, reset the record
      if (!data.windowStart) {
        tx.set(ref, {
          count: 1,
          windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
        });
        return { allowed: true, remaining: config.maxRequests - 1, resetAt };
      }

      const storedWindowStartMs = data.windowStart.toMillis();

      // If the stored window is different, we're in a new time window - reset counter
      if (storedWindowStartMs !== windowStartMs) {
        tx.set(ref, {
          count: 1,
          windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
        });
        return { allowed: true, remaining: config.maxRequests - 1, resetAt };
      }

      // Current window: check if at limit
      const currentCount = data.count || 0;
      if (currentCount >= config.maxRequests) {
        const secondsRemaining = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          message: `Rate limit exceeded. Try again in ${secondsRemaining} seconds.`,
        };
      }

      // Increment counter and return allowed
      const nextCount = currentCount + 1;
      tx.update(ref, { count: nextCount });
      return {
        allowed: true,
        remaining: Math.max(0, config.maxRequests - nextCount),
        resetAt,
      };
    });
  } catch {
    if (STRICT_PROD_RATE_LIMIT_BACKEND) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        message: 'Rate limit service is temporarily unavailable. Please retry shortly.',
      };
    }

    // Local/dev fallback when Firestore admin is unavailable.
    const fallback = checkRateLimit(`${config.scope}:${subject}`, {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
    });

    return {
      allowed: fallback.success,
      remaining: fallback.remaining,
      resetAt: new Date(fallback.resetTime),
      ...(fallback.success
        ? {}
        : {
            message: `Rate limit exceeded. Try again in ${Math.max(
              1,
              Math.ceil((fallback.resetTime - now) / 1000)
            )} seconds.`,
          }),
    };
  }
}

export async function getServerRateLimitStatus(
  subject: string,
  config: ServerRateLimitConfig
): Promise<ServerRateLimitStatus> {
  const { now, windowStartMs, resetAt } = getCurrentWindow(config);

  const distributedStatus = await getDistributedRateLimitStatus(subject, {
    scope: config.scope,
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
    timezoneOffsetMinutes: config.timezoneOffsetMinutes,
  });
  if (distributedStatus) {
    return distributedStatus;
  }

  try {
    const db = admin.firestore();
    const docId = `${config.scope}:${subject}`;
    const snap = await db.collection(COLLECTION).doc(docId).get();

    if (!snap.exists) {
      return {
        limit: config.maxRequests,
        used: 0,
        remaining: config.maxRequests,
        resetAt,
      };
    }

    const data = snap.data() as RateLimitDoc;
    
    // Safety check: ensure windowStart is valid
    if (!data.windowStart) {
      // If no window start, reset the record
      await db.collection(COLLECTION).doc(docId).update({
        windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
        count: 0,
      });
      return {
        limit: config.maxRequests,
        used: 0,
        remaining: config.maxRequests,
        resetAt,
      };
    }

    const storedWindowStartMs = data.windowStart.toMillis();

    // Check if we're in a new window (24+ hours have passed)
    if (storedWindowStartMs !== windowStartMs) {
      // Window has expired, reset the counter
      await db.collection(COLLECTION).doc(docId).update({
        windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
        count: 0,
      });
      return {
        limit: config.maxRequests,
        used: 0,
        remaining: config.maxRequests,
        resetAt,
      };
    }

    // We're in the same window - return current status
    const activeReservations = data.reservations
      ? Object.values(data.reservations).filter(
          (expiresAtMs) => Number.isFinite(expiresAtMs) && expiresAtMs > now
        ).length
      : 0;
    const used = Math.max(0, Math.min((data.count || 0) + activeReservations, config.maxRequests));
    const remaining = Math.max(0, config.maxRequests - used);

    return {
      limit: config.maxRequests,
      used,
      remaining,
      resetAt,
    };
  } catch {
    try {
      const fallback = getRateLimitStatus(`${config.scope}:${subject}`, {
        windowMs: config.windowMs,
        maxRequests: config.maxRequests,
      });

      return {
        limit: fallback.limit,
        used: fallback.used,
        remaining: fallback.remaining,
        resetAt: new Date(fallback.resetTime),
      };
    } catch {
      // Continue to strict fallback handling below.
    }

    if (STRICT_PROD_RATE_LIMIT_BACKEND) {
      return {
        limit: config.maxRequests,
        used: config.maxRequests,
        remaining: 0,
        resetAt,
      };
    }

    return {
      limit: config.maxRequests,
      used: config.maxRequests,
      remaining: 0,
      resetAt,
    };
  }
}
