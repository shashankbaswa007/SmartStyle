import type { User } from 'firebase/auth';

export type UsageWindow = {
  remaining: number;
  limit: number;
  resetAt?: string;
};

export type UsageStatusResponse = {
  usage: Record<string, UsageWindow | undefined>;
};

interface HttpLikeError {
  status: number;
  message: string;
  retryAfter: string | null;
}

function getTimezoneHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  return { 'x-timezone-offset-minutes': String(new Date().getTimezoneOffset()) };
}

export function parseUsageWindow(data: unknown): UsageWindow | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const candidate = data as { remaining?: unknown; limit?: unknown; resetAt?: unknown };
  if (typeof candidate.remaining !== 'number' || typeof candidate.limit !== 'number') {
    return undefined;
  }

  return {
    remaining: Math.max(0, candidate.remaining),
    limit: Math.max(0, candidate.limit),
    resetAt: typeof candidate.resetAt === 'string' ? candidate.resetAt : undefined,
  };
}

export async function fetchUsageStatus(params: {
  user: User;
  scopes: string[];
  lastForcedRefreshFailureAtRef: { current: number };
  cooldownMs?: number;
  timeoutMs?: number;
}): Promise<UsageStatusResponse> {
  const cooldownMs = params.cooldownMs ?? 120_000;
  const timeoutMs = params.timeoutMs ?? 6_000;

  const doFetch = async (forceRefreshToken: boolean) => {
    const idToken = await params.user.getIdToken(forceRefreshToken);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch('/api/usage-status', {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Cache-Control': 'no-cache',
          ...getTimezoneHeader(),
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  let response = await doFetch(false);

  if (response.status === 401) {
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
      throw {
        status: 401,
        message: 'Session refresh failed. Please sign in again.',
        retryAfter: null,
      } as HttpLikeError;
    }
  }

  if (!response.ok) {
    throw {
      status: response.status,
      message: 'Unable to load daily limits right now. Please retry.',
      retryAfter: response.headers.get('retry-after'),
    } as HttpLikeError;
  }

  const payload = await response.json();
  const usage = (payload?.usage || {}) as Record<string, unknown>;

  const parsed: Record<string, UsageWindow | undefined> = {};
  for (const scope of params.scopes) {
    parsed[scope] = parseUsageWindow(usage[scope]);
  }

  return { usage: parsed };
}
