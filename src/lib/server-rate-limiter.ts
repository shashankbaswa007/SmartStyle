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

export interface ServerRateLimitStatus {
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
}

interface RateLimitDoc {
  count: number;
  windowStart: admin.firestore.Timestamp;
}

const COLLECTION = 'rateLimits';

function getCurrentWindow(config: ServerRateLimitConfig) {
  const now = Date.now();
  const offsetMinutes = normalizeTimezoneOffsetMinutes(config.timezoneOffsetMinutes);
  const offsetMs = offsetMinutes * 60 * 1000;
  const shiftedNow = now - offsetMs;
  const windowStartMs = shiftedNow - (shiftedNow % config.windowMs) + offsetMs;
  const resetAt = new Date(windowStartMs + config.windowMs);
  return { now, windowStartMs, resetAt };
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
  const { windowStartMs, resetAt } = getCurrentWindow(config);

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
    const used = Math.max(0, Math.min(data.count || 0, config.maxRequests));
    const remaining = Math.max(0, config.maxRequests - used);

    return {
      limit: config.maxRequests,
      used,
      remaining,
      resetAt,
    };
  } catch {
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
  }
}
