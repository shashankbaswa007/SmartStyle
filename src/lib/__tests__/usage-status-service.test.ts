import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fetchUsageStatus, parseUsageWindow } from '@/lib/usage-status-service';

type MockResponseInput = {
  status: number;
  ok: boolean;
  body: unknown;
  retryAfter?: string | null;
};

function createMockResponse(input: MockResponseInput): Response {
  return {
    status: input.status,
    ok: input.ok,
    json: async () => input.body,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'retry-after' ? input.retryAfter ?? null : null),
    },
  } as unknown as Response;
}

describe('usage-status-service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses numeric-string usage values', () => {
    const parsed = parseUsageWindow({
      remaining: '7',
      limit: '10',
      resetAt: '2026-04-10T00:00:00.000Z',
    });

    expect(parsed).toEqual({
      remaining: 7,
      limit: 10,
      resetAt: '2026-04-10T00:00:00.000Z',
    });
  });

  it('throws when successful payload is missing required usage scope', async () => {
    const fetchMock = jest.fn(async () =>
      createMockResponse({
        status: 200,
        ok: true,
        body: {
          success: true,
          usage: {
            wardrobeOutfit: { remaining: 4, limit: 10, resetAt: '2026-04-10T00:00:00.000Z' },
          },
        },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchUsageStatus({
        user: null,
        scopes: ['recommend'],
        lastForcedRefreshFailureAtRef: { current: 0 },
      })
    ).rejects.toMatchObject({ status: 502 });
  });

  it('falls back to cookie-auth retry when user is unavailable and first call is 401', async () => {
    let callCount = 0;
    const fetchMock = jest.fn(async () => {
      callCount += 1;

      if (callCount === 1) {
        return createMockResponse({
          status: 401,
          ok: false,
          body: { error: 'Unauthorized' },
        });
      }

      return createMockResponse({
        status: 200,
        ok: true,
        body: {
          success: true,
          usage: {
            recommend: { remaining: 8, limit: 10, resetAt: '2026-04-10T00:00:00.000Z' },
          },
        },
      });
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchUsageStatus({
      user: null,
      scopes: ['recommend'],
      lastForcedRefreshFailureAtRef: { current: 0 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.usage.recommend).toEqual({
      remaining: 8,
      limit: 10,
      resetAt: '2026-04-10T00:00:00.000Z',
    });
  });

  it('accepts degraded usage payloads and exposes backend metadata', async () => {
    const fetchMock = jest.fn(async () =>
      createMockResponse({
        status: 200,
        ok: true,
        body: {
          success: true,
          degraded: true,
          backendAvailable: false,
          code: 'USAGE_BACKEND_UNAVAILABLE',
          diagnostic: 'RATE_LIMIT_BACKEND_UNAVAILABLE',
          usage: {
            recommend: { remaining: 10, limit: 10, resetAt: '2026-04-10T00:00:00.000Z' },
          },
          errorCategory: 'BACKEND_UNAVAILABLE',
        },
      })
    );

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchUsageStatus({
      user: null,
      scopes: ['recommend'],
      lastForcedRefreshFailureAtRef: { current: 0 },
    });

    expect(result.usage.recommend).toEqual({
      remaining: 10,
      limit: 10,
      resetAt: '2026-04-10T00:00:00.000Z',
    });
    expect(result.degraded).toBe(true);
    expect(result.backendAvailable).toBe(false);
    expect(result.code).toBe('USAGE_BACKEND_UNAVAILABLE');
    expect(result.diagnostic).toBe('RATE_LIMIT_BACKEND_UNAVAILABLE');
    expect(result.errorCategory).toBe('BACKEND_UNAVAILABLE');
  });

  it('returns typed timeout failure when usage API request aborts', async () => {
    const fetchMock = jest.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }
      });
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchUsageStatus({
        user: null,
        scopes: ['recommend'],
        lastForcedRefreshFailureAtRef: { current: 0 },
        timeoutMs: 30,
      })
    ).rejects.toMatchObject({ status: 504 });
  });

  it('returns typed failure when usage API returns invalid JSON', async () => {
    const fetchMock = jest.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new Error('Unexpected token < in JSON');
      },
      headers: {
        get: () => null,
      },
    } as unknown as Response));

    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchUsageStatus({
        user: null,
        scopes: ['recommend'],
        lastForcedRefreshFailureAtRef: { current: 0 },
      })
    ).rejects.toMatchObject({ status: 502 });
  });
});
