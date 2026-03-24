import { AuthError, verifyBearerTokenMatchesUser } from '@/lib/server-auth';
import { checkServerRateLimit } from '@/lib/server-rate-limiter';
import { DAILY_WINDOW_MS, RATE_LIMIT_SCOPES, USAGE_LIMITS } from '@/lib/usage-limits';

interface RecommendRateLimit {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
}

export async function enforceRecommendAuth(
  request: Request,
  requestedUserId?: string
): Promise<string | undefined> {
  if (!requestedUserId || requestedUserId === 'anonymous') {
    return requestedUserId;
  }

  await verifyBearerTokenMatchesUser(request, requestedUserId);
  return requestedUserId;
}

export async function enforceRecommendRateLimit(
  request: Request,
  requestedUserId?: string
): Promise<{ effectiveUserId: string; rateLimit: RecommendRateLimit }> {
  const effectiveUserId = requestedUserId || 'anonymous';
  const subject = requestedUserId && requestedUserId !== 'anonymous' ? requestedUserId : `anon:${request.headers.get('x-forwarded-for') || 'unknown'}`;
  const rateLimit = await checkServerRateLimit(subject, {
    scope: RATE_LIMIT_SCOPES.recommend,
    windowMs: DAILY_WINDOW_MS,
    maxRequests: USAGE_LIMITS.recommend,
  });

  return { effectiveUserId, rateLimit };
}

export { AuthError };
