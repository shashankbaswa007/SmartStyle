import admin from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limiter';

export interface ServerRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  scope: string;
}

export interface ServerRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
}

interface RateLimitDoc {
  count: number;
  windowStart: admin.firestore.Timestamp;
}

const COLLECTION = 'rateLimits';

export async function checkServerRateLimit(
  subject: string,
  config: ServerRateLimitConfig
): Promise<ServerRateLimitResult> {
  const now = Date.now();
  const windowStartMs = now - (now % config.windowMs);
  const resetAt = new Date(windowStartMs + config.windowMs);
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
      const storedWindowStartMs = data.windowStart.toMillis();

      if (storedWindowStartMs !== windowStartMs) {
        tx.set(ref, {
          count: 1,
          windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
        });
        return { allowed: true, remaining: config.maxRequests - 1, resetAt };
      }

      if (data.count >= config.maxRequests) {
        const secondsRemaining = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          message: `Rate limit exceeded. Try again in ${secondsRemaining} seconds.`,
        };
      }

      const nextCount = data.count + 1;
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
