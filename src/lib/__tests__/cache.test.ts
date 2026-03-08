import ResponseCache, { CACHE_TTL } from '@/lib/cache';

describe('ResponseCache', () => {
  let cache: InstanceType<typeof ResponseCache<string>>;

  beforeEach(() => {
    cache = new ResponseCache<string>(30, 5); // 30 min TTL, max 5 entries
  });

  it('stores and retrieves a value', () => {
    cache.set({ key: 'a' }, 'value-a');
    expect(cache.get({ key: 'a' })).toBe('value-a');
  });

  it('returns null for missing key', () => {
    expect(cache.get({ key: 'missing' })).toBeNull();
  });

  it('returns null for expired entry', () => {
    cache.set({ key: 'exp' }, 'data');

    // Advance time past TTL
    const original = Date.now;
    Date.now = () => original() + 31 * 60 * 1000; // 31 minutes later
    expect(cache.get({ key: 'exp' })).toBeNull();
    Date.now = original;
  });

  it('supports custom TTL per entry', () => {
    cache.set({ key: 'short' }, 'data', 1); // 1 minute TTL

    const original = Date.now;
    Date.now = () => original() + 2 * 60 * 1000; // 2 minutes later
    expect(cache.get({ key: 'short' })).toBeNull();
    Date.now = original;
  });

  it('evicts oldest entries when max size exceeded', () => {
    for (let i = 0; i < 6; i++) {
      cache.set({ i }, `val-${i}`);
    }
    // Max size is 5, so at least the oldest should be evicted
    expect(cache.size()).toBeLessThanOrEqual(5);
  });

  it('generates consistent keys for same params', () => {
    cache.set({ color: 'red', type: 'warm' }, 'result');
    expect(cache.get({ color: 'red', type: 'warm' })).toBe('result');
  });

  it('generates different keys for different params', () => {
    cache.set({ a: 1 }, 'one');
    cache.set({ a: 2 }, 'two');
    expect(cache.get({ a: 1 })).toBe('one');
    expect(cache.get({ a: 2 })).toBe('two');
  });

  it('clears all entries', () => {
    cache.set({ x: 1 }, 'a');
    cache.set({ x: 2 }, 'b');
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('cleanup removes expired entries', () => {
    cache.set({ key: 'stale' }, 'data');

    const original = Date.now;
    Date.now = () => original() + 31 * 60 * 1000;
    cache.cleanup();
    expect(cache.size()).toBe(0);
    Date.now = original;
  });
});

describe('CACHE_TTL constants', () => {
  it('defines expected TTL values', () => {
    expect(CACHE_TTL.IMAGE_ANALYSIS).toBe(86400);
    expect(CACHE_TTL.SHOPPING_LINKS).toBe(21600);
    expect(CACHE_TTL.WEATHER_DATA).toBe(1800);
    expect(CACHE_TTL.USER_PREFERENCES).toBe(3600);
    expect(CACHE_TTL.TAVILY_SEARCH).toBe(600);
  });
});
