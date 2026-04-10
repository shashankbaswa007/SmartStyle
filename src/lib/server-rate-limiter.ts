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
const ALLOW_IN_MEMORY_RATE_LIMIT_FALLBACK =
  process.env.ALLOW_IN_MEMORY_RATE_LIMIT_FALLBACK === '1' || process.env.NODE_ENV === 'test';

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

function resolveWindowState(params: {
  data: RateLimitDoc | undefined;
  requestedWindowStartMs: number;
  windowMs: number;
  now: number;
}): { windowStartMs: number; resetAt: Date; inCurrentWindow: boolean } {
  const storedWindowStartMs = params.data?.windowStart?.toMillis();

  if (Number.isFinite(storedWindowStartMs)) {
    const windowStartMs = storedWindowStartMs as number;
    const resetAtMs = windowStartMs + params.windowMs;

    // Freeze the active window until it actually expires to avoid early resets
    // from timezone header jitter across tabs, retries, or clients.
    if (params.now >= windowStartMs && params.now < resetAtMs) {
      return {
        windowStartMs,
        resetAt: new Date(resetAtMs),
        inCurrentWindow: true,
      };
    }
  }

  const resetAt = new Date(params.requestedWindowStartMs + params.windowMs);
  return {
    windowStartMs: params.requestedWindowStartMs,
    resetAt,
    inCurrentWindow: false,
  };
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
  const { now, windowStartMs: requestedWindowStartMs, resetAt } = getCurrentWindow(config);
  const reservationTtlMs = Math.max(1_000, options?.reservationTtlMs ?? 5 * 60_000);

  try {
    const db = admin.firestore();
    const ref = buildRateLimitRef(subject, config.scope);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existingData = (snap.exists ? (snap.data() as RateLimitDoc) : undefined);

      const resolvedWindow = resolveWindowState({
        data: existingData,
        requestedWindowStartMs,
        windowMs: config.windowMs,
        now,
      });
      const activeWindowStartMs = resolvedWindow.windowStartMs;
      const activeResetAt = resolvedWindow.resetAt;
      const inCurrentWindow = resolvedWindow.inCurrentWindow;

      const baseCount = inCurrentWindow
        ? Math.max(0, existingData?.count || 0)
        : 0;
      const reservations = inCurrentWindow
        ? cleanReservations(existingData?.reservations, now)
        : {};
      const confirmations = inCurrentWindow
        ? cleanMapByMinTs(existingData?.confirmations, activeWindowStartMs)
        : {};

      if (confirmations[reservationId]) {
        tx.set(ref, {
          count: baseCount,
          windowStart: admin.firestore.Timestamp.fromMillis(activeWindowStartMs),
          reservations,
          confirmations,
        }, { merge: true });

        return {
          allowed: true,
          remaining: Math.max(0, config.maxRequests - baseCount),
          resetAt: activeResetAt,
          reservationId,
          replayed: true,
        };
      }

      if (reservations[reservationId]) {
        tx.set(ref, {
          count: baseCount,
          windowStart: admin.firestore.Timestamp.fromMillis(activeWindowStartMs),
          reservations,
          confirmations,
        }, { merge: true });

        return {
          allowed: true,
          remaining: Math.max(0, config.maxRequests - baseCount),
          resetAt: activeResetAt,
          reservationId,
          replayed: true,
        };
      }

      const activeReservations = Object.keys(reservations).length;
      if (baseCount + activeReservations >= config.maxRequests) {
        const secondsRemaining = Math.max(1, Math.ceil((activeResetAt.getTime() - now) / 1000));
        tx.set(ref, {
          count: baseCount,
          windowStart: admin.firestore.Timestamp.fromMillis(activeWindowStartMs),
          reservations,
          confirmations,
        }, { merge: true });
        return {
          allowed: false,
          remaining: Math.max(0, config.maxRequests - baseCount),
          resetAt: activeResetAt,
          message: `Daily limit reached. Try again in ${secondsRemaining} seconds.`,
        };
      }

      reservations[reservationId] = now + reservationTtlMs;
      tx.set(ref, {
        count: baseCount,
        windowStart: admin.firestore.Timestamp.fromMillis(activeWindowStartMs),
        reservations,
        confirmations,
      }, { merge: true });

      return {
        allowed: true,
        remaining: Math.max(0, config.maxRequests - baseCount),
        resetAt: activeResetAt,
        reservationId,
      };
    });
  } catch {
    if (ALLOW_IN_MEMORY_RATE_LIMIT_FALLBACK) {
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
        // Continue to conservative fallback below.
      }
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
  const { now, windowStartMs: requestedWindowStartMs, resetAt } = getCurrentWindow(config);

  try {
    const db = admin.firestore();
    const ref = buildRateLimitRef(subject, config.scope);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existingData = (snap.exists ? (snap.data() as RateLimitDoc) : undefined);

      const resolvedWindow = resolveWindowState({
        data: existingData,
        requestedWindowStartMs,
        windowMs: config.windowMs,
        now,
      });
      const activeWindowStartMs = resolvedWindow.windowStartMs;
      const activeResetAt = resolvedWindow.resetAt;
      const inCurrentWindow = resolvedWindow.inCurrentWindow;

      const baseCount = inCurrentWindow
        ? Math.max(0, existingData?.count || 0)
        : 0;
      const reservations = inCurrentWindow
        ? cleanReservations(existingData?.reservations, now)
        : {};
      const confirmations = inCurrentWindow
        ? cleanMapByMinTs(existingData?.confirmations, activeWindowStartMs)
        : {};

      if (!confirmations[reservationId]) {
        if (reservations[reservationId]) {
          delete reservations[reservationId];
          confirmations[reservationId] = now;
          const nextCount = Math.min(config.maxRequests, baseCount + 1);
          tx.set(ref, {
            count: nextCount,
            windowStart: admin.firestore.Timestamp.fromMillis(activeWindowStartMs),
            reservations,
            confirmations,
          }, { merge: true });
          return {
            limit: config.maxRequests,
            used: nextCount,
            remaining: Math.max(0, config.maxRequests - nextCount),
            resetAt: activeResetAt,
          };
        }
      }

      const used = Math.max(0, Math.min(baseCount, config.maxRequests));
      tx.set(ref, {
        count: used,
        windowStart: admin.firestore.Timestamp.fromMillis(activeWindowStartMs),
        reservations,
        confirmations,
      }, { merge: true });

      return {
        limit: config.maxRequests,
        used,
        remaining: Math.max(0, config.maxRequests - used),
        resetAt: activeResetAt,
      };
    });
  } catch {
    if (ALLOW_IN_MEMORY_RATE_LIMIT_FALLBACK) {
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

    return {
      limit: config.maxRequests,
      used: config.maxRequests,
      remaining: 0,
      resetAt,
    };
  }
}

export async function releaseServerRateLimit(
  subject: string,
  config: ServerRateLimitConfig,
  reservationId: string
): Promise<void> {
  const { now, windowStartMs: requestedWindowStartMs } = getCurrentWindow(config);

  try {
    const db = admin.firestore();
    const ref = buildRateLimitRef(subject, config.scope);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;

      const data = snap.data() as RateLimitDoc;
      const resolvedWindow = resolveWindowState({
        data,
        requestedWindowStartMs,
        windowMs: config.windowMs,
        now,
      });
      const inWindow = resolvedWindow.inCurrentWindow;
      const activeWindowStartMs = resolvedWindow.windowStartMs;
      const reservations = inWindow
        ? cleanReservations(data.reservations, now)
        : {};
      const confirmations = inWindow
        ? cleanMapByMinTs(data.confirmations, activeWindowStartMs)
        : {};

      if (!reservations[reservationId]) {
        return;
      }

      delete reservations[reservationId];
      tx.set(ref, {
        count: Math.max(0, data.count || 0),
        windowStart: admin.firestore.Timestamp.fromMillis(activeWindowStartMs),
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
  const { now, windowStartMs: requestedWindowStartMs, resetAt } = getCurrentWindow(config);

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
          windowStart: admin.firestore.Timestamp.fromMillis(requestedWindowStartMs),
        });
        return { allowed: true, remaining: config.maxRequests - 1, resetAt };
      }

      const data = snap.data() as RateLimitDoc;
      
      // Safety check: if windowStart is missing or invalid, reset the record
      if (!data.windowStart) {
        tx.set(ref, {
          count: 1,
          windowStart: admin.firestore.Timestamp.fromMillis(requestedWindowStartMs),
        });
        return { allowed: true, remaining: config.maxRequests - 1, resetAt };
      }

      const resolvedWindow = resolveWindowState({
        data,
        requestedWindowStartMs,
        windowMs: config.windowMs,
        now,
      });

      // If previous window has expired, start a new one.
      if (!resolvedWindow.inCurrentWindow) {
        tx.set(ref, {
          count: 1,
          windowStart: admin.firestore.Timestamp.fromMillis(resolvedWindow.windowStartMs),
        });
        return { allowed: true, remaining: config.maxRequests - 1, resetAt: resolvedWindow.resetAt };
      }

      // Current window: check if at limit
      const currentCount = data.count || 0;
      if (currentCount >= config.maxRequests) {
        const secondsRemaining = Math.max(1, Math.ceil((resolvedWindow.resetAt.getTime() - now) / 1000));
        return {
          allowed: false,
          remaining: 0,
          resetAt: resolvedWindow.resetAt,
          message: `Rate limit exceeded. Try again in ${secondsRemaining} seconds.`,
        };
      }

      // Increment counter and return allowed
      const nextCount = currentCount + 1;
      tx.update(ref, { count: nextCount });
      return {
        allowed: true,
        remaining: Math.max(0, config.maxRequests - nextCount),
        resetAt: resolvedWindow.resetAt,
      };
    });
  } catch {
    if (ALLOW_IN_MEMORY_RATE_LIMIT_FALLBACK) {
      // Local/dev fallback when explicitly enabled.
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

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      message: 'Rate limit service is temporarily unavailable. Please retry shortly.',
    };
  }
}

async function getFirestoreRateLimitStatus(
  subject: string,
  config: ServerRateLimitConfig,
  timing: { now: number; windowStartMs: number; resetAt: Date }
): Promise<ServerRateLimitStatus> {
  const { now, windowStartMs, resetAt } = timing;
  const db = admin.firestore();
  const docId = `${config.scope}:${subject}`;
  const docRef = db.collection(COLLECTION).doc(docId);
  const snap = await docRef.get();

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
    await docRef.update({
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

  const resolvedWindow = resolveWindowState({
    data,
    requestedWindowStartMs: windowStartMs,
    windowMs: config.windowMs,
    now,
  });

  // Check if we're in a new window (24+ hours have passed)
  if (!resolvedWindow.inCurrentWindow) {
    // Window has expired, reset the counter
    await docRef.update({
      windowStart: admin.firestore.Timestamp.fromMillis(resolvedWindow.windowStartMs),
      count: 0,
    });
    return {
      limit: config.maxRequests,
      used: 0,
      remaining: config.maxRequests,
      resetAt: resolvedWindow.resetAt,
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
    resetAt: resolvedWindow.resetAt,
  };
}

export async function getServerRateLimitStatus(
  subject: string,
  config: ServerRateLimitConfig
): Promise<ServerRateLimitStatus> {
  const { now, windowStartMs, resetAt } = getCurrentWindow(config);

  const distributedStatusPromise = getDistributedRateLimitStatus(subject, {
    scope: config.scope,
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
    timezoneOffsetMinutes: config.timezoneOffsetMinutes,
  });

  const firestoreStatusPromise = getFirestoreRateLimitStatus(subject, config, {
    now,
    windowStartMs,
    resetAt,
  });

  const [distributedStatus, firestoreStatus] = await Promise.all([
    distributedStatusPromise.catch(() => null),
    firestoreStatusPromise.catch(() => null),
  ]);

  if (distributedStatus && firestoreStatus) {
    const used = Math.max(distributedStatus.used, firestoreStatus.used);
    const remaining = Math.max(0, config.maxRequests - used);
    return {
      limit: config.maxRequests,
      used,
      remaining,
      // Firestore is the source of truth for reserved/confirmed usage windows.
      resetAt: firestoreStatus.resetAt,
    };
  }

  if (firestoreStatus) {
    return firestoreStatus;
  }

  if (distributedStatus) {
    return distributedStatus;
  }

  if (!ALLOW_IN_MEMORY_RATE_LIMIT_FALLBACK) {
    throw new Error('Persistent rate limit status backend unavailable');
  }

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
    return {
      limit: config.maxRequests,
      used: config.maxRequests,
      remaining: 0,
      resetAt,
    };
  }
}
