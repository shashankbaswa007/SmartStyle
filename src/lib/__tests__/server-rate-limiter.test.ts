import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('server-rate-limiter production safeguards', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  async function loadLimiterModule(params: {
    nodeEnv: 'production' | 'test';
    allowInMemoryFallback?: '1' | '0' | undefined;
    fallbackSuccess?: boolean;
    fallbackThrows?: boolean;
  }) {
    process.env = {
      ...originalEnv,
      NODE_ENV: params.nodeEnv,
      ALLOW_IN_MEMORY_RATE_LIMIT_FALLBACK: params.allowInMemoryFallback,
    };

    jest.doMock('@/lib/distributed-rate-limiter', () => ({
      checkDistributedRateLimit: jest.fn(async () => null),
      getDistributedRateLimitStatus: jest.fn(async () => null),
    }));

    jest.doMock('@/lib/firebase-admin', () => ({
      __esModule: true,
      default: {
        firestore: jest.fn(() => {
          throw new Error('firestore unavailable');
        }),
      },
    }));

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn(() => {
        if (params.fallbackThrows) {
          throw new Error('fallback unavailable');
        }
        return {
          success: params.fallbackSuccess ?? true,
          remaining: 7,
          resetTime: Date.now() + 60_000,
          limit: 10,
        };
      }),
      getRateLimitStatus: jest.fn(() => {
        if (params.fallbackThrows) {
          throw new Error('fallback unavailable');
        }
        return {
          limit: 10,
          used: 3,
          remaining: 7,
          resetTime: Date.now() + 60_000,
        };
      }),
    }));

    return import('../server-rate-limiter');
  }

  it('uses in-memory reserve/status fallback in strict production when available', async () => {
    const mod = await loadLimiterModule({
      nodeEnv: 'production',
      allowInMemoryFallback: undefined,
    });

    const reserveResult = await mod.reserveServerRateLimit('user-1', {
      scope: 'recommend',
      maxRequests: 10,
      windowMs: 60_000,
    }, 'res-1');

    expect(reserveResult.allowed).toBe(true);
    expect(reserveResult.remaining).toBe(7);

    const statusResult = await mod.getServerRateLimitStatus('user-1', {
      scope: 'recommend',
      maxRequests: 10,
      windowMs: 60_000,
    });

    expect(statusResult.limit).toBe(10);
    expect(statusResult.used).toBe(3);
    expect(statusResult.remaining).toBe(7);
  });

  it('returns conservative exhausted status only when both backends are unavailable', async () => {
    const mod = await loadLimiterModule({
      nodeEnv: 'production',
      allowInMemoryFallback: undefined,
      fallbackThrows: true,
    });

    const reserveResult = await mod.reserveServerRateLimit('user-1', {
      scope: 'recommend',
      maxRequests: 10,
      windowMs: 60_000,
    }, 'res-2');

    expect(reserveResult.allowed).toBe(false);
    expect(reserveResult.remaining).toBe(0);
    expect(reserveResult.message).toContain('temporarily unavailable');

    const statusResult = await mod.getServerRateLimitStatus('user-1', {
      scope: 'recommend',
      maxRequests: 10,
      windowMs: 60_000,
    });

    expect(statusResult.limit).toBe(10);
    expect(statusResult.used).toBe(10);
    expect(statusResult.remaining).toBe(0);
  });

  it('uses in-memory fallback outside strict production mode', async () => {
    const mod = await loadLimiterModule({
      nodeEnv: 'test',
      fallbackSuccess: true,
    });

    const result = await mod.checkServerRateLimit('user-1', {
      scope: 'recommend',
      maxRequests: 10,
      windowMs: 60_000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(7);
    expect(result.message).toBeUndefined();
  });

  it('includes active reservations in status usage math', async () => {
    const now = 1_700_000_000_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      ALLOW_IN_MEMORY_RATE_LIMIT_FALLBACK: undefined,
    };

    const runTransactionMock = jest.fn(async (handler: any) => {
      const tx = {
        get: async () => ({
          exists: true,
          data: () => ({
            count: 4,
            windowStart: { toMillis: () => now - (now % 60_000) },
            reservations: {
              active: now + 10_000,
              expired: now - 10_000,
            },
          }),
        }),
        set: jest.fn(),
      };
      return handler(tx);
    });

    jest.doMock('@/lib/distributed-rate-limiter', () => ({
      checkDistributedRateLimit: jest.fn(async () => null),
      getDistributedRateLimitStatus: jest.fn(async () => null),
    }));

    jest.doMock('@/lib/firebase-admin', () => ({
      __esModule: true,
      default: {
        firestore: jest.fn(() => ({
          runTransaction: runTransactionMock,
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              get: jest.fn(async () => ({
                exists: true,
                data: () => ({
                  count: 4,
                  windowStart: { toMillis: () => now - (now % 60_000) },
                  reservations: {
                    active: now + 10_000,
                    expired: now - 10_000,
                  },
                }),
              })),
            })),
          })),
        })),
      },
    }));

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn(),
      getRateLimitStatus: jest.fn(),
    }));

    const mod = await import('../server-rate-limiter');
    const result = await mod.getServerRateLimitStatus('user-2', {
      scope: 'recommend',
      maxRequests: 10,
      windowMs: 60_000,
    });

    expect(result.used).toBe(5);
    expect(result.remaining).toBe(5);
    dateNowSpy.mockRestore();
  });
});
