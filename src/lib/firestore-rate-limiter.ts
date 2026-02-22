import { db } from '@/lib/firebase';
import { doc, runTransaction, Timestamp } from 'firebase/firestore';

// Server-side API routes have no request.auth context, so Firestore
// security rules reject all reads/writes with PERMISSION_DENIED.
// Detect this and skip Firestore entirely — graceful degradation.
const isServerSide = typeof window === 'undefined';

export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
}> {
  // Server-side: Firestore client SDK lacks auth context — skip to avoid PERMISSION_DENIED
  if (isServerSide) {
    return { allowed: true, remaining: -1, resetAt: new Date() };
  }

  try {
    const maxRequests = 20;
    const limitsRef = doc(db, 'rateLimits', userId);
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    const resetAt = new Date(hourStart.getTime() + 3600000);

    // Use a Firestore transaction to atomically read+write the counter
    // This prevents two concurrent requests from both reading count=19
    // and both writing count=20 (bypassing the limit).
    const result = await runTransaction(db, async (transaction) => {
      const limitsSnap = await transaction.get(limitsRef);

      if (!limitsSnap.exists()) {
        // First request this hour — create the doc
        transaction.set(limitsRef, {
          count: 1,
          hourStart: Timestamp.fromDate(hourStart),
        });
        return { allowed: true, remaining: maxRequests - 1, resetAt };
      }

      const data = limitsSnap.data();
      const lastHourStart = data.hourStart.toDate();

      // New hour window — reset counter
      if (hourStart > lastHourStart) {
        transaction.set(limitsRef, {
          count: 1,
          hourStart: Timestamp.fromDate(hourStart),
        });
        return { allowed: true, remaining: maxRequests - 1, resetAt };
      }

      // Limit exceeded
      if (data.count >= maxRequests) {
        const actualResetAt = new Date(lastHourStart.getTime() + 3600000);
        const minutesUntilReset = Math.ceil((actualResetAt.getTime() - now.getTime()) / 60000);
        return {
          allowed: false,
          remaining: 0,
          resetAt: actualResetAt,
          message: `Rate limit exceeded. You can make ${maxRequests} requests per hour. Please try again in ${minutesUntilReset} minutes.`,
        };
      }

      // Atomically increment
      transaction.update(limitsRef, { count: data.count + 1 });
      return {
        allowed: true,
        remaining: maxRequests - data.count - 1,
        resetAt: new Date(lastHourStart.getTime() + 3600000),
      };
    });

    return result;
  } catch (error) {
    // Allow request if rate limiting check fails (graceful degradation)
    return { 
      allowed: true, 
      remaining: -1, 
      resetAt: new Date() 
    };
  }
}
