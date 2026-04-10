import admin from '@/lib/firebase-admin';
import { AuthError, verifyBearerToken, verifyFirebaseIdToken } from '@/lib/server-auth';
import { reserveServerRateLimit } from '@/lib/server-rate-limiter';
import { DAILY_WINDOW_MS, getTimezoneOffsetMinutesFromRequest, RATE_LIMIT_SCOPES, USAGE_LIMITS } from '@/lib/usage-limits';

interface RecommendRateLimit {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
}

const SESSION_COOKIE_NAME = 'smartstyle-session';

function getSessionTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieParts = cookieHeader.split(';').map((part) => part.trim());
  const sessionPair = cookieParts.find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!sessionPair) return null;

  try {
    const rawToken = sessionPair.slice(`${SESSION_COOKIE_NAME}=`.length);
    const token = rawToken ? decodeURIComponent(rawToken) : '';
    return token || null;
  } catch {
    return null;
  }
}

async function verifySessionCookieToken(sessionToken: string): Promise<string | null> {
  try {
    const decoded = await admin.auth().verifySessionCookie(sessionToken);
    return decoded.uid;
  } catch {
    // Fall through to ID-token verifier for environments where auth/session cookie stores an ID token.
  }

  return verifyFirebaseIdToken(sessionToken, { allowDevFallback: false });
}

async function resolveAuthenticatedUserId(request: Request): Promise<string> {
  let bearerError: unknown = null;

  try {
    return await verifyBearerToken(request);
  } catch (error) {
    bearerError = error;
  }

  const sessionToken = getSessionTokenFromCookie(request);
  if (sessionToken) {
    const uid = await verifySessionCookieToken(sessionToken);
    if (uid) {
      return uid;
    }
  }

  if (bearerError instanceof AuthError) {
    throw bearerError;
  }

  throw new AuthError('Unauthorized - Missing bearer token', 401);
}

export async function enforceRecommendAuth(
  request: Request,
  requestedUserId?: string
): Promise<string | undefined> {
  if (!requestedUserId || requestedUserId === 'anonymous') {
    return requestedUserId;
  }

  const authenticatedUserId = await resolveAuthenticatedUserId(request);
  if (authenticatedUserId !== requestedUserId) {
    throw new AuthError('Forbidden - User ID mismatch', 403);
  }

  return requestedUserId;
}

export async function enforceRecommendRateLimit(
  request: Request,
  requestedUserId: string | undefined,
  reservationId: string
): Promise<{ effectiveUserId: string; rateLimit: RecommendRateLimit }> {
  const effectiveUserId = requestedUserId || 'anonymous';
  const subject = requestedUserId && requestedUserId !== 'anonymous' ? requestedUserId : `anon:${request.headers.get('x-forwarded-for') || 'unknown'}`;
  const timezoneOffsetMinutes = getTimezoneOffsetMinutesFromRequest(request);
  const rateLimit = await reserveServerRateLimit(subject, {
    scope: RATE_LIMIT_SCOPES.recommend,
    windowMs: DAILY_WINDOW_MS,
    maxRequests: USAGE_LIMITS.recommend,
    timezoneOffsetMinutes,
  }, reservationId, { reservationTtlMs: 15 * 60_000 });

  return { effectiveUserId, rateLimit };
}

export { AuthError };
