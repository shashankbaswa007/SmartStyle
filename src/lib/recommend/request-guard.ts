import { getClientIdentifier } from '@/lib/rate-limiter';
import { AuthError, verifyBearerTokenMatchesUser } from '@/lib/server-auth';
import { checkServerRateLimit } from '@/lib/server-rate-limiter';

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
  const clientId = getClientIdentifier(request);
  const rateLimit = await checkServerRateLimit(`${effectiveUserId}:${clientId}`, {
    scope: 'recommend',
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
  });

  return { effectiveUserId, rateLimit };
}

export { AuthError };
