import { NextResponse } from 'next/server';
import { verifyBearerToken, verifyFirebaseIdToken, AuthError } from '@/lib/server-auth';
import admin from '@/lib/firebase-admin';
import { getServerRateLimitStatus } from '@/lib/server-rate-limiter';
import { logger } from '@/lib/logger';
import {
  DAILY_WINDOW_MS,
  getTimezoneOffsetMinutesFromRequest,
  RATE_LIMIT_SCOPES,
  USAGE_LIMITS,
  USAGE_TIMEZONE_STRATEGY,
} from '@/lib/usage-limits';

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

    const recommendUsage = sanitizeUsageStatus(recommend);
    const wardrobeOutfitUsage = sanitizeUsageStatus(wardrobeOutfit);
    const wardrobeUploadUsage = sanitizeUsageStatus(wardrobeUpload);

    logger.info('Usage status fetched', {
      requestId,
      userId,
      timezoneOffsetMinutes,
      timezoneStrategy: USAGE_TIMEZONE_STRATEGY,
      usage: {
        recommend: recommendUsage,
        [RATE_LIMIT_SCOPES.wardrobeOutfit]: wardrobeOutfitUsage,
        [RATE_LIMIT_SCOPES.wardrobeUpload]: wardrobeUploadUsage,
      },
    });

    return NextResponse.json(
      {
        success: true,
        requestId,
        timezoneStrategy: USAGE_TIMEZONE_STRATEGY,
        usage: {
          recommend: recommendUsage,
          [RATE_LIMIT_SCOPES.wardrobeOutfit]: wardrobeOutfitUsage,
          [RATE_LIMIT_SCOPES.wardrobeUpload]: wardrobeUploadUsage,
          // Temporary legacy aliases for backward compatibility during rollout.
          wardrobeOutfit: wardrobeOutfitUsage,
          wardrobeUpload: wardrobeUploadUsage,
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      logger.warn('Usage status auth failed', {
        requestId,
        status: error.status,
        message: error.message,
      });

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

    const errorMessage = error instanceof Error ? error.message : String(error);
    const persistentBackendUnavailable =
      errorMessage.includes('Persistent rate limit status backend unavailable') ||
      errorMessage.includes('Firebase Admin SDK not initialized');

    if (persistentBackendUnavailable) {
      logger.error('Usage status backend unavailable', {
        requestId,
        error,
      });

      return NextResponse.json(
        {
          success: false,
          requestId,
          error: 'Usage backend is temporarily unavailable',
          code: 'USAGE_BACKEND_UNAVAILABLE',
        },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    logger.error('Usage status fetch failed', {
      requestId,
      error,
    });

    return NextResponse.json(
      {
        success: false,
        requestId,
        error: 'Failed to fetch usage status',
        code: 'USAGE_STATUS_FAILED',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
