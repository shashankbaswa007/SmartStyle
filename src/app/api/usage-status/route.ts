import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyBearerToken, verifyFirebaseIdToken, AuthError } from '@/lib/server-auth';
import admin from '@/lib/firebase-admin';
import { getServerRateLimitStatus } from '@/lib/server-rate-limiter';
import { logger } from '@/lib/logger';
import { incrementProductionCounter } from '@/lib/production-telemetry';
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

const USAGE_STATUS_ENDPOINT = '/api/usage-status';
const USAGE_STATUS_SLOW_REQUEST_MS = 1200;

type ObservabilityErrorCategory = 'ENV_MISCONFIGURED' | 'BACKEND_UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN_ERROR';

const SESSION_COOKIE_NAME = 'smartstyle-session';
let googleJwksRemote: unknown = null;

function resolveRequestId(request: Request): string {
  const inboundRequestId = request.headers.get('x-request-id');
  if (inboundRequestId && inboundRequestId.trim().length > 0) {
    return inboundRequestId.trim();
  }

  return `usage-status-${crypto.randomUUID()}`;
}

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

function buildUsagePayload(
  recommendUsage: ReturnType<typeof sanitizeUsageStatus>,
  wardrobeOutfitUsage: ReturnType<typeof sanitizeUsageStatus>,
  wardrobeUploadUsage: ReturnType<typeof sanitizeUsageStatus>
) {
  return {
    recommend: recommendUsage,
    [RATE_LIMIT_SCOPES.wardrobeOutfit]: wardrobeOutfitUsage,
    [RATE_LIMIT_SCOPES.wardrobeUpload]: wardrobeUploadUsage,
    // Temporary legacy aliases for backward compatibility during rollout.
    wardrobeOutfit: wardrobeOutfitUsage,
    wardrobeUpload: wardrobeUploadUsage,
  };
}

function buildDegradedUsagePayload() {
  const fallbackResetAt = new Date(Date.now() + DAILY_WINDOW_MS);

  const recommendUsage = sanitizeUsageStatus({
    limit: USAGE_LIMITS.recommend,
    used: 0,
    remaining: USAGE_LIMITS.recommend,
    resetAt: fallbackResetAt,
  });
  const wardrobeOutfitUsage = sanitizeUsageStatus({
    limit: USAGE_LIMITS.wardrobeOutfit,
    used: 0,
    remaining: USAGE_LIMITS.wardrobeOutfit,
    resetAt: fallbackResetAt,
  });
  const wardrobeUploadUsage = sanitizeUsageStatus({
    limit: USAGE_LIMITS.wardrobeUpload,
    used: 0,
    remaining: USAGE_LIMITS.wardrobeUpload,
    resetAt: fallbackResetAt,
  });

  return buildUsagePayload(recommendUsage, wardrobeOutfitUsage, wardrobeUploadUsage);
}

function getUsageBackendMissingEnv(): string[] {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    missing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    missing.push('FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS');
  }

  return missing;
}

function classifyUsageBackendDiagnostic(errorMessage: string):
  | 'FIREBASE_ADMIN_NOT_INITIALIZED'
  | 'RATE_LIMIT_BACKEND_UNAVAILABLE'
  | 'USAGE_BACKEND_UNAVAILABLE' {
  if (errorMessage.includes('Firebase Admin SDK not initialized')) {
    return 'FIREBASE_ADMIN_NOT_INITIALIZED';
  }

  if (errorMessage.includes('Persistent rate limit status backend unavailable')) {
    return 'RATE_LIMIT_BACKEND_UNAVAILABLE';
  }

  return 'USAGE_BACKEND_UNAVAILABLE';
}

function classifyUsageErrorCategory(errorMessage: string): ObservabilityErrorCategory {
  const normalized = errorMessage.toLowerCase();

  if (normalized.includes('timeout') || normalized.includes('timed out') || normalized.includes('abort')) {
    return 'TIMEOUT';
  }

  if (
    normalized.includes('temporarily unavailable') ||
    normalized.includes('backend unavailable') ||
    normalized.includes('service unavailable')
  ) {
    return 'BACKEND_UNAVAILABLE';
  }

  return 'UNKNOWN_ERROR';
}

function toLogSafeError(error: unknown): { name?: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: String(error),
  };
}

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const requestStartedAt = Date.now();
  const requestLogger =
    typeof logger.withContext === 'function'
      ? logger.withContext({
          endpoint: USAGE_STATUS_ENDPOINT,
          requestId,
        })
      : logger;

  const logLifecycle = (
    status: 'start' | 'success' | 'degraded' | 'error',
    details: Record<string, unknown> = {}
  ) => {
    const durationMs = Date.now() - requestStartedAt;
    const isSlow = durationMs >= USAGE_STATUS_SLOW_REQUEST_MS;
    const event = {
      requestId,
      endpoint: USAGE_STATUS_ENDPOINT,
      status,
      durationMs,
      isSlow,
      observedAt: new Date().toISOString(),
      errorCode: null,
      errorCategory: null,
      ...(status === 'degraded' ? { degraded: true, backendAvailable: false } : {}),
      ...details,
    };

    if (status === 'error') {
      requestLogger.error('usage_status.request_lifecycle', event);
    } else if (status === 'degraded') {
      requestLogger.warn('usage_status.request_lifecycle', event);
    } else {
      requestLogger.info('usage_status.request_lifecycle', event);
    }

    if (status !== 'start') {
      if (isSlow) {
        requestLogger.warn('usage_status.slow_request', {
          requestId,
          endpoint: USAGE_STATUS_ENDPOINT,
          status,
          durationMs,
          errorCode: event.errorCode,
          errorCategory: event.errorCategory,
        });
      }

      incrementProductionCounter('usage_status.response_time_ms', durationMs, {
        endpoint: USAGE_STATUS_ENDPOINT,
        status,
      });

      if (isSlow) {
        incrementProductionCounter('usage_status.slow_total', 1, {
          endpoint: USAGE_STATUS_ENDPOINT,
          status,
        });
      }
    }
  };

  logLifecycle('start');

  incrementProductionCounter('usage_status.requests_total', 1, { route: 'api/usage-status' });
  let timezoneOffsetMinutes = 0;

  try {
    const userId = await resolveAuthenticatedUserId(request);
    timezoneOffsetMinutes = getTimezoneOffsetMinutesFromRequest(request);

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

    logLifecycle('success', {
      errorCode: null,
      backendAvailable: true,
      degraded: false,
      timezoneOffsetMinutes,
      timezoneStrategy: USAGE_TIMEZONE_STRATEGY,
    });

    incrementProductionCounter('usage_status.success_total', 1, {
      route: 'api/usage-status',
    });

    return NextResponse.json(
      {
        success: true,
        requestId,
        timezoneStrategy: USAGE_TIMEZONE_STRATEGY,
        backendAvailable: true,
        usage: buildUsagePayload(recommendUsage, wardrobeOutfitUsage, wardrobeUploadUsage),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      const errorCode = error.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED';
      const errorCategory: ObservabilityErrorCategory = 'UNKNOWN_ERROR';

      logLifecycle('error', {
        errorCode,
        errorCategory,
        httpStatus: error.status,
      });

      incrementProductionCounter('usage_status.auth_error_total', 1, {
        route: 'api/usage-status',
        status: error.status,
      });

      return NextResponse.json(
        {
          success: false,
          requestId,
          error: error.message,
          code: errorCode,
          errorCategory,
        },
        { status: error.status, headers: NO_STORE_HEADERS }
      );
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const diagnostic = classifyUsageBackendDiagnostic(errorMessage);
    const missingCritical = getUsageBackendMissingEnv();
    const classifiedErrorCategory = classifyUsageErrorCategory(errorMessage);
    const errorCategory: ObservabilityErrorCategory =
      missingCritical.length > 0 ? 'ENV_MISCONFIGURED' : classifiedErrorCategory;

    logLifecycle('degraded', {
      errorCode: 'USAGE_BACKEND_UNAVAILABLE',
      errorCategory,
      backendAvailable: false,
      degraded: true,
      diagnostic,
      missingCritical,
    });

    requestLogger.warn('Usage status backend degraded', {
      errorCode: 'USAGE_BACKEND_UNAVAILABLE',
      errorCategory,
      diagnostic,
      error: toLogSafeError(error),
    });

    incrementProductionCounter('usage_status.degraded_total', 1, {
      route: 'api/usage-status',
      diagnostic,
    });

    return NextResponse.json(
      {
        success: true,
        requestId,
        timezoneStrategy: USAGE_TIMEZONE_STRATEGY,
        backendAvailable: false,
        degraded: true,
        error: 'Usage backend is temporarily unavailable. Serving estimated limits.',
        code: 'USAGE_BACKEND_UNAVAILABLE',
        errorCategory,
        diagnostic,
        ...(missingCritical.length > 0 ? { missingCritical } : {}),
        usage: buildDegradedUsagePayload(),
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  }
}
