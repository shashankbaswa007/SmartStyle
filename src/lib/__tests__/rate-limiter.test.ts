import { checkRateLimit, type RateLimitConfig } from '@/lib/rate-limiter';

describe('checkRateLimit', () => {
  const config: RateLimitConfig = {
    windowMs: 60_000, // 1 minute
    maxRequests: 3,
  };

  // Use unique identifiers per test to avoid cross-test pollution
  let testId = 0;
  const uid = () => `test-user-${++testId}-${Date.now()}`;

  it('allows the first request', () => {
    const result = checkRateLimit(uid(), config);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.limit).toBe(3);
  });

  it('decrements remaining count on each request', () => {
    const id = uid();
    checkRateLimit(id, config);
    const r2 = checkRateLimit(id, config);
    expect(r2.remaining).toBe(1);
    const r3 = checkRateLimit(id, config);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests once limit is exceeded', () => {
    const id = uid();
    checkRateLimit(id, config);
    checkRateLimit(id, config);
    checkRateLimit(id, config);
    const r4 = checkRateLimit(id, config);
    expect(r4.success).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('resets after window expires', () => {
    const id = uid();
    checkRateLimit(id, config);
    checkRateLimit(id, config);
    checkRateLimit(id, config);

    // Simulate time passing beyond the window
    const original = Date.now;
    Date.now = () => original() + 61_000;
    const result = checkRateLimit(id, config);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
    Date.now = original;
  });

  it('tracks different identifiers independently', () => {
    const a = uid();
    const b = uid();
    checkRateLimit(a, config);
    checkRateLimit(a, config);
    checkRateLimit(a, config);

    const resultB = checkRateLimit(b, config);
    expect(resultB.success).toBe(true);
    expect(resultB.remaining).toBe(2);
  });

  it('returns correct resetTime', () => {
    const id = uid();
    const before = Date.now();
    const result = checkRateLimit(id, config);
    expect(result.resetTime).toBeGreaterThanOrEqual(before + config.windowMs);
  });
});
