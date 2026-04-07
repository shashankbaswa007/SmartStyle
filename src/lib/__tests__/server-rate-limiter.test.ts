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
      checkRateLimit: jest.fn(() => ({
        success: params.fallbackSuccess ?? true,
        remaining: 7,
        resetTime: Date.now() + 60_000,
        limit: 10,
      })),
      getRateLimitStatus: jest.fn(() => ({
        limit: 10,
        used: 3,
        remaining: 7,
        resetTime: Date.now() + 60_000,
      })),
    }));

    return import('../server-rate-limiter');
  }

  it('denies requests in strict production when backends are unavailable', async () => {
    const mod = await loadLimiterModule({
      nodeEnv: 'production',
      allowInMemoryFallback: undefined,
    });

    const result = await mod.checkServerRateLimit('user-1', {
      scope: 'recommend',
      maxRequests: 10,
      windowMs: 60_000,
    });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.message).toContain('temporarily unavailable');
  });

  it('returns conservative exhausted status in strict production when backends are unavailable', async () => {
    const mod = await loadLimiterModule({
      nodeEnv: 'production',
      allowInMemoryFallback: undefined,
    });

    const result = await mod.getServerRateLimitStatus('user-1', {
      scope: 'recommend',
      maxRequests: 10,
      windowMs: 60_000,
    });

    expect(result.limit).toBe(10);
    expect(result.used).toBe(10);
    expect(result.remaining).toBe(0);
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
});
