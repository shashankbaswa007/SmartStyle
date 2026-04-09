import { NextResponse } from 'next/server';
import { verifyBearerToken, verifyFirebaseIdToken, AuthError } from '@/lib/server-auth';
import admin from '@/lib/firebase-admin';
import { getServerRateLimitStatus } from '@/lib/server-rate-limiter';
import { DAILY_WINDOW_MS, getTimezoneOffsetMinutesFromRequest, RATE_LIMIT_SCOPES, USAGE_LIMITS } from '@/lib/usage-limits';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

const SESSION_COOKIE_NAME = 'smartstyle-session';
let googleJwksRemote: unknown = null;

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
    // Fall through to JWT verification paths below.
  }

  try {
    const { createRemoteJWKSet } = await import('jose/jwks/remote');
    const { jwtVerify } = await import('jose/jwt/verify');

    if (!googleJwksRemote) {
      googleJwksRemote = createRemoteJWKSet(
        new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
      );
    }

    const { payload } = await jwtVerify(sessionToken, googleJwksRemote as Parameters<typeof jwtVerify>[1]);
    const issuer = typeof payload.iss === 'string' ? payload.iss : '';
    const audience = typeof payload.aud === 'string' ? payload.aud : '';
    const subject = typeof payload.sub === 'string' ? payload.sub : '';

    if (!subject || !issuer || !audience) {
      return null;
    }

    const validIssuers = new Set([
      `https://securetoken.google.com/${audience}`,
      `https://session.firebase.google.com/${audience}`,
    ]);

    if (!validIssuers.has(issuer)) {
      return null;
    }

    return subject;
  } catch {
    // In local dev, session cookie sync can briefly drift. Try ID token verifier as a final fallback.
    return verifyFirebaseIdToken(sessionToken, { allowDevFallback: true });
  }
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

function sanitizeUsageStatus(status: { limit: number; used: number; remaining: number; resetAt: Date }) {
  const limit = Number.isFinite(status.limit) ? Math.max(0, Math.floor(status.limit)) : 0;
  const used = Number.isFinite(status.used) ? Math.max(0, Math.floor(status.used)) : 0;
  const remainingRaw = Number.isFinite(status.remaining) ? Math.floor(status.remaining) : 0;
  const remaining = Math.max(0, Math.min(limit, remainingRaw));
  const fallbackResetAt = new Date(Date.now() + DAILY_WINDOW_MS).toISOString();
  const resetAt =
    status.resetAt instanceof Date && !Number.isNaN(status.resetAt.getTime())
      ? status.resetAt.toISOString()
      : fallbackResetAt;

  return {
    limit,
    used,
    remaining,
    resetAt,
  };
}

function getDefaultUsagePayload() {
  const resetAt = new Date(Date.now() + DAILY_WINDOW_MS).toISOString();
  return {
    recommend: {
      limit: USAGE_LIMITS.recommend,
      used: 0,
      remaining: USAGE_LIMITS.recommend,
      resetAt,
    },
    [RATE_LIMIT_SCOPES.wardrobeOutfit]: {
      limit: USAGE_LIMITS.wardrobeOutfit,
      used: 0,
      remaining: USAGE_LIMITS.wardrobeOutfit,
      resetAt,
    },
    [RATE_LIMIT_SCOPES.wardrobeUpload]: {
      limit: USAGE_LIMITS.wardrobeUpload,
      used: 0,
      remaining: USAGE_LIMITS.wardrobeUpload,
      resetAt,
    },
  };
}

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') || `usage-status-${Date.now()}`;

  try {
    const userId = await resolveAuthenticatedUserId(request);
    const timezoneOffsetMinutes = getTimezoneOffsetMinutesFromRequest(request);

    const [recommend, wardrobeOutfit, wardrobeUpload] = await Promise.all([
      getServerRateLimitStatus(userId, {
        scope: RATE_LIMIT_SCOPES.recommend,
        windowMs: DAILY_WINDOW_MS,
        maxRequests: USAGE_LIMITS.recommend,
        timezoneOffsetMinutes,
      }),
      getServerRateLimitStatus(userId, {
        scope: RATE_LIMIT_SCOPES.wardrobeOutfit,
        windowMs: DAILY_WINDOW_MS,
        maxRequests: USAGE_LIMITS.wardrobeOutfit,
        timezoneOffsetMinutes,
      }),
      getServerRateLimitStatus(userId, {
        scope: RATE_LIMIT_SCOPES.wardrobeUpload,
        windowMs: DAILY_WINDOW_MS,
        maxRequests: USAGE_LIMITS.wardrobeUpload,
        timezoneOffsetMinutes,
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        requestId,
        usage: {
          recommend: sanitizeUsageStatus(recommend),
          [RATE_LIMIT_SCOPES.wardrobeOutfit]: sanitizeUsageStatus(wardrobeOutfit),
          [RATE_LIMIT_SCOPES.wardrobeUpload]: sanitizeUsageStatus(wardrobeUpload),
          // Temporary legacy aliases for backward compatibility during rollout.
          wardrobeOutfit: sanitizeUsageStatus(wardrobeOutfit),
          wardrobeUpload: sanitizeUsageStatus(wardrobeUpload),
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: error.message,
          code: error.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
        },
        { status: error.status, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: false,
        requestId,
        error: 'Failed to fetch usage status',
        code: 'USAGE_STATUS_FAILED',
        usage: getDefaultUsagePayload(),
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
