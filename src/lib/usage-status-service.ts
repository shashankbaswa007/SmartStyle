import type { User } from 'firebase/auth';

export type UsageWindow = {
  remaining: number;
  limit: number;
  resetAt?: string;
};

export type UsageStatusResponse = {
  usage: Record<string, UsageWindow | undefined>;
  requestId?: string;
  timezoneStrategy?: string;
  degraded?: boolean;
  backendAvailable?: boolean;
  code?: string;
  errorCategory?: string;
  diagnostic?: string;
};

const LEGACY_SCOPE_ALIASES: Record<string, string[]> = {
  'wardrobe-outfit': ['wardrobeOutfit'],
  'wardrobe-upload': ['wardrobeUpload'],
};

interface HttpLikeError {
  status: number;
  message: string;
  retryAfter: string | null;
  requestId?: string;
  code?: string;
  errorCategory?: string;
}

function debugUsageStatus(message: string, context: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[usage-status-service]', message, context);
}

function getTimezoneHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  return { 'x-timezone-offset-minutes': String(new Date().getTimezoneOffset()) };
}

export function parseUsageWindow(data: unknown): UsageWindow | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const candidate = data as { remaining?: unknown; limit?: unknown; resetAt?: unknown };
  const parsedRemaining =
    typeof candidate.remaining === 'number'
      ? candidate.remaining
      : typeof candidate.remaining === 'string'
        ? Number(candidate.remaining)
        : NaN;
  const parsedLimit =
    typeof candidate.limit === 'number'
      ? candidate.limit
      : typeof candidate.limit === 'string'
        ? Number(candidate.limit)
        : NaN;

  if (!Number.isFinite(parsedRemaining) || !Number.isFinite(parsedLimit)) {
    return undefined;
  }

  const limit = Math.max(0, Math.floor(parsedLimit));
  const remaining = Math.max(0, Math.min(limit, Math.floor(parsedRemaining)));
  const parsedResetAt =
    typeof candidate.resetAt === 'string' &&
    candidate.resetAt.trim().length > 0 &&
    !Number.isNaN(new Date(candidate.resetAt).getTime())
      ? candidate.resetAt
      : undefined;

  return {
    remaining,
    limit,
    resetAt: parsedResetAt,
  };
}

function getScopedUsageWindow(usage: Record<string, unknown>, scope: string): UsageWindow | undefined {
  const direct = parseUsageWindow(usage[scope]);
  if (direct) return direct;

  const aliases = LEGACY_SCOPE_ALIASES[scope] || [];
  for (const alias of aliases) {
    const parsed = parseUsageWindow(usage[alias]);
    if (parsed) return parsed;
  }

  return undefined;
}

export async function fetchUsageStatus(params: {
  user?: User | null;
  scopes: string[];
  lastForcedRefreshFailureAtRef: { current: number };
  cooldownMs?: number;
  timeoutMs?: number;
}): Promise<UsageStatusResponse> {
  const cooldownMs = params.cooldownMs ?? 120_000;
  const timeoutMs = params.timeoutMs ?? 6_000;
  const idTokenTimeoutMs = Math.max(1_500, Math.min(4_000, Math.floor(timeoutMs * 0.6)));

  const resolveIdToken = async (forceRefreshToken: boolean): Promise<string | null> => {
    if (!params.user) {
      return null;
    }

    const tokenPromise = params.user
      .getIdToken(forceRefreshToken)
      .then((token) => token || null)
      .catch(() => null);

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), idTokenTimeoutMs);
    });

    return Promise.race([tokenPromise, timeoutPromise]);
  };

  const doFetch = async (forceRefreshToken: boolean, options?: { forceCookieAuth?: boolean }) => {
    const idToken = options?.forceCookieAuth ? null : await resolveIdToken(forceRefreshToken);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch('/api/usage-status', {
        cache: 'no-store',
        headers: {
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          'Cache-Control': 'no-cache',
          ...getTimezoneHeader(),
        },
        credentials: 'include',
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw {
          status: 504,
          message: 'Usage status request timed out. Please retry.',
          retryAfter: null,
        } as HttpLikeError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  let response = await doFetch(false);

  if (response.status === 401) {
    if (!params.user) {
      response = await doFetch(false, { forceCookieAuth: true });
    } else {
      if (Date.now() - params.lastForcedRefreshFailureAtRef.current < cooldownMs) {
        throw {
          status: 401,
          message: 'Session refresh is cooling down. Please retry in a moment.',
          retryAfter: String(Math.ceil(cooldownMs / 1000)),
        } as HttpLikeError;
      }

      try {
        response = await doFetch(true);
      } catch {
        params.lastForcedRefreshFailureAtRef.current = Date.now();

        // If token refresh path is flaky, try cookie-auth before surfacing a hard auth failure.
        try {
          response = await doFetch(false, { forceCookieAuth: true });
        } catch {
          throw {
            status: 401,
            message: 'Session refresh failed. Please sign in again.',
            retryAfter: null,
          } as HttpLikeError;
        }

        if (response.status === 401) {
          throw {
            status: 401,
            message: 'Session refresh failed. Please sign in again.',
            retryAfter: null,
          } as HttpLikeError;
        }
      }

      if (response.status === 401) {
        response = await doFetch(false, { forceCookieAuth: true });
      }
    }
  }

  if (!response.ok) {
    let payloadObject: Record<string, unknown> = {};
    try {
      const payload = await response.json();
      payloadObject = payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};
    } catch {
      payloadObject = {};
    }

    const requestId =
      typeof payloadObject.requestId === 'string'
        ? payloadObject.requestId
        : undefined;
    const code = typeof payloadObject.code === 'string' ? payloadObject.code : undefined;
    const errorCategory =
      typeof payloadObject.errorCategory === 'string'
        ? payloadObject.errorCategory
        : undefined;

    debugUsageStatus('backend_usage_fetch_failed', {
      status: response.status,
      requestId,
      code,
      errorCategory,
      scopes: params.scopes,
      hasUser: Boolean(params.user),
    });

    if (response.status === 503) {
      const diagnostic =
        typeof payloadObject.diagnostic === 'string'
          ? payloadObject.diagnostic
          : undefined;

      if (code === 'USAGE_BACKEND_UNAVAILABLE') {
        const messageByDiagnostic: Record<string, string> = {
          FIREBASE_ADMIN_NOT_INITIALIZED:
            'Daily usage backend is unavailable in production. Configure FIREBASE_SERVICE_ACCOUNT_KEY in Vercel and redeploy.',
          RATE_LIMIT_BACKEND_UNAVAILABLE:
            'Daily usage backend is temporarily unavailable. Firestore/Redis usage tracking is not reachable right now.',
        };

        throw {
          status: response.status,
          message:
            (diagnostic ? messageByDiagnostic[diagnostic] : null) ||
            'Daily usage backend is temporarily unavailable in production. Verify Firebase Admin and rate-limit backends, then redeploy.',
          retryAfter: response.headers.get('retry-after'),
          requestId,
          code,
          errorCategory,
        } as HttpLikeError;
      }
    }

    const backendMessage =
      typeof payloadObject.error === 'string'
        ? payloadObject.error
        : typeof payloadObject.message === 'string'
          ? payloadObject.message
          : 'Unable to load daily limits right now. Please retry.';

    throw {
      status: response.status,
      message: backendMessage,
      retryAfter: response.headers.get('retry-after'),
      requestId,
      code,
      errorCategory,
    } as HttpLikeError;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw {
      status: 502,
      message: 'Usage status returned an invalid response.',
      retryAfter: null,
    } as HttpLikeError;
  }

  const payloadObject = payload && typeof payload === 'object'
    ? (payload as Record<string, unknown>)
    : {};
  const usage = (
    payloadObject.usage && typeof payloadObject.usage === 'object'
      ? payloadObject.usage
      : {}
  ) as Record<string, unknown>;

  const parsed: Record<string, UsageWindow | undefined> = {};
  for (const scope of params.scopes) {
    parsed[scope] = getScopedUsageWindow(usage, scope);
  }

  const requestId = typeof payloadObject.requestId === 'string' ? payloadObject.requestId : undefined;
  const timezoneStrategy =
    typeof payloadObject.timezoneStrategy === 'string' ? payloadObject.timezoneStrategy : undefined;
  const backendAvailable =
    typeof payloadObject.backendAvailable === 'boolean'
      ? payloadObject.backendAvailable
      : undefined;
  const degraded = payloadObject.degraded === true || backendAvailable === false;
  const code = typeof payloadObject.code === 'string' ? payloadObject.code : undefined;
  const errorCategory =
    typeof payloadObject.errorCategory === 'string'
      ? payloadObject.errorCategory
      : undefined;
  const diagnostic = typeof payloadObject.diagnostic === 'string' ? payloadObject.diagnostic : undefined;

  const missingScopes = params.scopes.filter((scope) => !parsed[scope]);
  if (missingScopes.length > 0 && !degraded) {
    throw {
      status: 502,
      message: `Usage status response was incomplete for scope(s): ${missingScopes.join(', ')}`,
      retryAfter: null,
    } as HttpLikeError;
  }

  if (missingScopes.length > 0 && degraded) {
    debugUsageStatus('backend_usage_fetch_partial_degraded_payload', {
      requestId,
      missingScopes,
      scopes: params.scopes,
      code,
      errorCategory,
      diagnostic,
    });
  }

  debugUsageStatus('backend_usage_fetch_succeeded', {
    requestId,
    timezoneStrategy,
    degraded,
    backendAvailable,
    errorCategory,
    scopes: params.scopes,
    usage: parsed,
  });

  return {
    usage: parsed,
    requestId,
    timezoneStrategy,
    degraded,
    backendAvailable,
    code,
    errorCategory,
    diagnostic,
  };
}
