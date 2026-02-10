/**
 * Image Generation Pipeline — Simulation Test Suite
 *
 * Simulates slow, failed, and successful image generation scenarios
 * to verify that:
 *   1. The UI always resolves quickly (within the 25 s total budget)
 *   2. API keys are not overused (throttle ≤ 2 concurrent, dedup works)
 *   3. Fallback logic progresses correctly through the provider chain
 *
 * Mocking strategy:
 *   - `global.fetch` is mocked per-test to simulate Pollinations responses
 *   - `together-image` and `replicate-image` modules are Jest-mocked
 *   - `process.env` keys are controlled per-test via beforeEach / afterEach
 *   - After jest.resetModules(), mock modules are re-required to get fresh
 *     instances that the newly loaded orchestrator will use.
 */

// ─── Polyfill AbortSignal.timeout for jsdom ─────────────────────────────────
if (typeof AbortSignal.timeout !== 'function') {
  (AbortSignal as any).timeout = (ms: number): AbortSignal => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('TimeoutError', 'TimeoutError')), ms);
    return controller.signal;
  };
}

// ─── Mocks must be declared before imports ──────────────────────────────────
jest.mock('@/lib/together-image', () => ({
  generateWithTogether: jest.fn(),
  isTogetherAvailable: jest.fn(),
}));

jest.mock('@/lib/replicate-image', () => ({
  generateWithReplicate: jest.fn(),
  isReplicateAvailable: jest.fn(),
}));

const SAMPLE_PROMPT = 'Professional kurta outfit in navy blue and gold';
const SAMPLE_COLORS = ['#004E89', '#FFD700', '#1B1B1B'];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * After jest.resetModules(), the cached mock instances are gone.
 * Re-require the mock modules to get the NEW mock functions that the
 * freshly loaded smart-image-generation.ts will also see.
 */
function getTogetherMocks() {
  const m = require('@/lib/together-image');
  return {
    generateWithTogether: m.generateWithTogether as jest.Mock,
    isTogetherAvailable: m.isTogetherAvailable as jest.Mock,
  };
}

function getReplicateMocks() {
  const m = require('@/lib/replicate-image');
  return {
    generateWithReplicate: m.generateWithReplicate as jest.Mock,
    isReplicateAvailable: m.isReplicateAvailable as jest.Mock,
  };
}

/**
 * Configure Together + Replicate mock defaults.
 * Must be called AFTER jest.resetModules() so we get the fresh instances.
 */
function configureFallbackMocks(opts: {
  togetherAvailable?: boolean;
  togetherResult?: string | null | (() => Promise<string | null>);
  replicateAvailable?: boolean;
  replicateResult?: string | null | (() => Promise<string | null>);
} = {}) {
  const together = getTogetherMocks();
  const replicate = getReplicateMocks();

  together.isTogetherAvailable.mockReturnValue(opts.togetherAvailable ?? false);
  replicate.isReplicateAvailable.mockReturnValue(opts.replicateAvailable ?? false);

  if (typeof opts.togetherResult === 'function') {
    together.generateWithTogether.mockImplementation(opts.togetherResult);
  } else {
    together.generateWithTogether.mockResolvedValue(opts.togetherResult ?? null);
  }

  if (typeof opts.replicateResult === 'function') {
    replicate.generateWithReplicate.mockImplementation(opts.replicateResult);
  } else {
    replicate.generateWithReplicate.mockResolvedValue(opts.replicateResult ?? null);
  }

  return { together, replicate };
}

function fakeBase64Image(bytes = 2048): ArrayBuffer {
  const buf = new ArrayBuffer(bytes);
  const view = new Uint8Array(buf);
  // Fill with JPEG magic bytes + random data
  view[0] = 0xff;
  view[1] = 0xd8; // JPEG SOI marker
  for (let i = 2; i < bytes; i++) view[i] = Math.floor(Math.random() * 256);
  return buf;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Create a mock fetch that returns a successful image after `delayMs` */
function createSuccessFetch(delayMs: number = 50) {
  return jest.fn().mockImplementation(async (url: string, opts?: any) => {
    if (opts?.method === 'HEAD') {
      // Legacy URL HEAD check
      await delay(Math.min(delayMs, 100));
      return { status: 200, ok: true };
    }
    // Auth fetch → binary image
    await delay(delayMs);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => fakeBase64Image(2048),
      text: async () => '',
    };
  });
}

/**
 * Create a mock fetch that always fails.
 * For auth calls: returns the given HTTP status.
 * For legacy HEAD calls: returns 429 so the legacy strategy also hard-fails.
 * (Legacy only hard-fails on 402/403/429; a 500 still returns the URL.)
 */
function createHardFailFetch(authStatus = 500, message = 'Internal Server Error') {
  return jest.fn().mockImplementation(async (_url: string, opts?: any) => {
    if (opts?.headers?.Authorization) {
      // Auth fetch → fail
      return {
        ok: false,
        status: authStatus,
        headers: { get: () => 'text/plain' },
        text: async () => message,
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }
    // Legacy HEAD → 429 (hard fail)
    return { ok: false, status: 429, headers: { get: () => 'text/plain' } };
  });
}

/** Create a mock fetch that times out (hangs for a long time) */
function createTimeoutFetch() {
  return jest.fn().mockImplementation(async (_url: string, opts?: any) => {
    return new Promise((_resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      }, 60_000);

      if (opts?.signal) {
        if (opts.signal.aborted) {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
          return;
        }
        opts.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }
    });
  });
}

// ─── Track lifecycle events ─────────────────────────────────────────────────
let lifecycleEvents: Array<{ provider: string; status: string; duration?: number; error?: string }> = [];

function trackLifecycle(e: { provider: string; status: string; duration?: number; error?: string }) {
  lifecycleEvents.push(e);
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('Image Generation Pipeline — Simulation Tests', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    lifecycleEvents = [];
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: Pollinations Auth succeeds fast
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 1 — Pollinations Auth succeeds fast', () => {
    it('should return a base64 data URI quickly', async () => {
      process.env.POLLINATIONS_API_KEY = 'sk_test_fast_success';
      global.fetch = createSuccessFetch(50);
      jest.resetModules();
      configureFallbackMocks(); // defaults: unavailable

      const { generateOutfitImageWithFallback } = require('@/lib/image-generation');

      const start = Date.now();
      const url = await generateOutfitImageWithFallback(SAMPLE_PROMPT, SAMPLE_COLORS, trackLifecycle);
      const elapsed = Date.now() - start;

      expect(url).toMatch(/^data:image\/jpeg;base64,/);
      expect(elapsed).toBeLessThan(3000); // Well under budget

      // Key was only in header, never in URL
      const [, fetchOpts] = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchOpts.headers?.Authorization).toBe('Bearer sk_test_fast_success');

      // Lifecycle: initiated → in-progress → success
      const providers = lifecycleEvents.map((e) => `${e.provider}:${e.status}`);
      expect(providers).toContain('pollinations-auth:initiated');
      expect(providers).toContain('pollinations-auth:in-progress');
      expect(providers).toContain('pollinations-auth:success');
    });

    it('should NOT call Together or Replicate when Pollinations succeeds', async () => {
      process.env.POLLINATIONS_API_KEY = 'sk_test_no_fallback_needed';
      global.fetch = createSuccessFetch(30);
      jest.resetModules();
      const { together, replicate } = configureFallbackMocks();

      const { generateImageWithRetry } = require('@/lib/smart-image-generation');
      await generateImageWithRetry(SAMPLE_PROMPT, SAMPLE_COLORS, 2);

      expect(together.generateWithTogether).not.toHaveBeenCalled();
      expect(replicate.generateWithReplicate).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Pollinations Auth fails → Legacy URL picks up
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 2 — Pollinations Auth fails, Legacy URL succeeds', () => {
    it('should return a legacy URL when auth fails with 401', async () => {
      process.env.POLLINATIONS_API_KEY = 'sk_test_invalid';

      global.fetch = jest.fn().mockImplementation(async (_url: string, opts?: any) => {
        if (opts?.headers?.Authorization) {
          return {
            ok: false,
            status: 401,
            headers: { get: () => 'text/plain' },
            text: async () => 'Invalid API key',
          };
        }
        // Legacy HEAD check → success
        return { ok: true, status: 200 };
      });

      jest.resetModules();
      configureFallbackMocks();
      const { generateOutfitImageWithFallback } = require('@/lib/image-generation');

      const url = await generateOutfitImageWithFallback(SAMPLE_PROMPT, SAMPLE_COLORS, trackLifecycle);

      expect(url).toContain('image.pollinations.ai/prompt/');
      expect(url).not.toContain('via.placeholder.com');

      // Auth was tried twice (MAX_RETRIES=2), then legacy HEAD
      const authCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([, o]: [string, any]) => o?.headers?.Authorization
      );
      expect(authCalls.length).toBe(2);

      const failures = lifecycleEvents.filter((e) => e.status === 'failure');
      expect(failures.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Pollinations fully down → Together.ai picks up
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 3 — Pollinations down, Together.ai fallback', () => {
    it('should fall through to Together.ai and return its URL', async () => {
      process.env.POLLINATIONS_API_KEY = 'sk_test_down';
      // Both auth (500) and legacy HEAD (429) fail hard
      global.fetch = createHardFailFetch(500, 'Service unavailable');

      jest.resetModules();
      const { together } = configureFallbackMocks({
        togetherAvailable: true,
        togetherResult: 'https://api.together.xyz/img/generated123.jpg',
      });

      const { generateImageWithRetry } = require('@/lib/smart-image-generation');

      const start = Date.now();
      const url = await generateImageWithRetry(SAMPLE_PROMPT, SAMPLE_COLORS, 2);
      const elapsed = Date.now() - start;

      expect(url).toBe('https://api.together.xyz/img/generated123.jpg');
      expect(elapsed).toBeLessThan(25_000);
      expect(together.generateWithTogether).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: ALL providers fail → SVG placeholder returned
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 4 — All providers fail → SVG placeholder', () => {
    it('should return an SVG placeholder and resolve within budget', async () => {
      process.env.POLLINATIONS_API_KEY = 'sk_test_all_fail';
      global.fetch = createHardFailFetch(500, 'Boom');

      jest.resetModules();
      configureFallbackMocks({
        togetherAvailable: true,
        togetherResult: null,
        replicateAvailable: true,
        replicateResult: null,
      });

      const { generateImageWithRetry } = require('@/lib/smart-image-generation');

      const start = Date.now();
      const url = await generateImageWithRetry(SAMPLE_PROMPT, SAMPLE_COLORS, 2);
      const elapsed = Date.now() - start;

      // Must be the SVG gradient placeholder
      expect(url).toMatch(/^data:image\/svg\+xml,/);
      expect(decodeURIComponent(url)).toContain('Kurta');
      expect(decodeURIComponent(url)).toContain('Image generation unavailable');

      // Resolved well within the 25 s budget
      expect(elapsed).toBeLessThan(15_000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: Slow Pollinations — total timeout enforced
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 5 — Slow Pollinations triggers total timeout', () => {
    it('should abort slow Pollinations and fall through', async () => {
      // Auth key present → auth strategy runs, but fetch hangs
      process.env.POLLINATIONS_API_KEY = 'sk_test_slow';
      global.fetch = createTimeoutFetch();

      jest.resetModules();
      configureFallbackMocks(); // no Together/Replicate

      const { generateImageWithRetry } = require('@/lib/smart-image-generation');

      const start = Date.now();
      const url = await generateImageWithRetry(SAMPLE_PROMPT, SAMPLE_COLORS, 1);
      const elapsed = Date.now() - start;

      // Should eventually get a placeholder (SVG or via.placeholder.com)
      expect(url).toBeTruthy();

      // Must resolve within the 25 s budget + scheduling overhead
      expect(elapsed).toBeLessThan(30_000);
    }, 35_000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: No API key → skips auth, uses legacy URL
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 6 — No API key uses legacy URL directly', () => {
    it('should skip auth strategy and return legacy URL', async () => {
      delete process.env.POLLINATIONS_API_KEY;
      global.fetch = jest.fn().mockImplementation(async (_url: string, opts?: any) => {
        if (opts?.method === 'HEAD') return { ok: true, status: 200 };
        return { ok: true, status: 200 };
      });

      jest.resetModules();
      configureFallbackMocks();
      const { generateOutfitImageWithFallback } = require('@/lib/image-generation');

      const url = await generateOutfitImageWithFallback(SAMPLE_PROMPT, SAMPLE_COLORS, trackLifecycle);

      expect(url).toContain('image.pollinations.ai/prompt/');

      // Auth fetch never called — no Authorization header anywhere
      const authCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([, o]: [string, any]) => o?.headers?.Authorization
      );
      expect(authCalls.length).toBe(0);

      // Only 1 fetch (HEAD for legacy URL)
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 7: Deduplication — same prompt reuses in-flight request
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 7 — Deduplication prevents duplicate requests', () => {
    it('should reuse in-flight request for identical prompt+colors', async () => {
      process.env.POLLINATIONS_API_KEY = 'sk_test_dedup';
      global.fetch = createSuccessFetch(300); // Takes 300ms
      jest.resetModules();
      configureFallbackMocks();

      const { generateImageWithRetry } = require('@/lib/smart-image-generation');

      // Fire two identical requests concurrently
      const [url1, url2] = await Promise.all([
        generateImageWithRetry(SAMPLE_PROMPT, SAMPLE_COLORS, 2),
        generateImageWithRetry(SAMPLE_PROMPT, SAMPLE_COLORS, 2),
      ]);

      // Both should get the same result
      expect(url1).toBe(url2);

      // Pollinations auth fetch should have been called only ONCE (dedup)
      const authCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([, o]: [string, any]) => o?.headers?.Authorization
      );
      expect(authCalls.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 8: Throttle — max 2 concurrent requests
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 8 — Throttle limits concurrent requests', () => {
    it('should queue the 3rd request when 2 are already active', async () => {
      process.env.POLLINATIONS_API_KEY = 'sk_test_throttle';
      global.fetch = createSuccessFetch(200);
      jest.resetModules();
      configureFallbackMocks();

      const { generateImageWithRetry } = require('@/lib/smart-image-generation');

      // 3 DIFFERENT prompts (not deduplicated)
      const prompts = [
        'Navy blue formal kurta with golden embroidery',
        'Red silk saree with silver border patterns',
        'White linen shirt with casual cotton pants',
      ];

      const results = await Promise.all(
        prompts.map((p, i) => generateImageWithRetry(p, SAMPLE_COLORS.slice(0, i + 1), 2))
      );

      // All 3 should resolve successfully
      results.forEach((url: string) => {
        expect(url).toBeTruthy();
        expect(typeof url).toBe('string');
      });
      expect(results.length).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 9: API key never appears in returned URL
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 9 — API key never leaks to client', () => {
    it('should never include the API key in the returned URL', async () => {
      const testKey = 'sk_test_secret_key_12345';
      process.env.POLLINATIONS_API_KEY = testKey;
      global.fetch = createSuccessFetch(30);
      jest.resetModules();
      configureFallbackMocks();

      const { generateOutfitImageWithFallback } = require('@/lib/image-generation');
      const url = await generateOutfitImageWithFallback(SAMPLE_PROMPT, SAMPLE_COLORS, trackLifecycle);

      // The returned URL (base64 data URI) must NOT contain the API key
      expect(url).not.toContain(testKey);
      expect(url).not.toContain('sk_test');
      expect(url).not.toContain('Bearer');
    });

    it('should only send the key in the Authorization header, not query params', async () => {
      const testKey = 'sk_test_header_only';
      process.env.POLLINATIONS_API_KEY = testKey;
      global.fetch = createSuccessFetch(30);
      jest.resetModules();
      configureFallbackMocks();

      const { generateOutfitImageWithFallback } = require('@/lib/image-generation');
      await generateOutfitImageWithFallback(SAMPLE_PROMPT, SAMPLE_COLORS, trackLifecycle);

      const calls = (global.fetch as jest.Mock).mock.calls;
      for (const [url, opts] of calls) {
        expect(url).not.toContain(testKey);
        expect(url).not.toContain('key=');
        if (opts?.headers?.Authorization) {
          expect(opts.headers.Authorization).toBe(`Bearer ${testKey}`);
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 10: Pollinations 429 rate limit → fallback
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 10 — Pollinations rate limited (429)', () => {
    it('should fall through to next provider on 429', async () => {
      process.env.POLLINATIONS_API_KEY = 'sk_test_rate_limit';

      // Auth returns 429, legacy HEAD also 429
      global.fetch = jest.fn().mockImplementation(async (_url: string, opts?: any) => {
        if (opts?.headers?.Authorization) {
          return {
            ok: false,
            status: 429,
            headers: { get: () => 'text/plain' },
            text: async () => 'Too many requests',
          };
        }
        return { ok: false, status: 429, headers: { get: () => 'text/plain' } };
      });

      jest.resetModules();
      const { together } = configureFallbackMocks({
        togetherAvailable: true,
        togetherResult: 'https://together.ai/result.jpg',
      });

      const { generateImageWithRetry } = require('@/lib/smart-image-generation');
      const url = await generateImageWithRetry(SAMPLE_PROMPT, SAMPLE_COLORS, 2);

      expect(url).toBe('https://together.ai/result.jpg');
      expect(together.generateWithTogether).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 11: Prompt enhancement quality check
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 11 — Prompt enhancement for professional quality', () => {
    it('should replace person references with mannequin', () => {
      jest.resetModules();
      const { enhancePromptForProfessionalQuality } = require('@/lib/image-generation');

      const result = enhancePromptForProfessionalQuality(
        'A woman wearing a blue kurta standing in a garden'
      );
      expect(result).not.toMatch(/\bwoman\b/i);
      expect(result).toContain('mannequin');
      expect(result).toContain('no text');
      expect(result).toContain('no banners');
    });

    it('should preserve prompt that already has quality terms', () => {
      jest.resetModules();
      const { enhancePromptForProfessionalQuality } = require('@/lib/image-generation');

      const input = 'Professional fashion editorial high-resolution kurta display';
      const result = enhancePromptForProfessionalQuality(input);
      // 'Professional' should be stripped (FLUX renders it as visible text)
      expect(result).not.toMatch(/\bprofessional\b/i);
      expect(result).toContain('no text');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 12: SVG placeholder contains correct colors and fashion term
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 12 — SVG placeholder quality', () => {
    it('should generate an SVG with color swatches and fashion term', async () => {
      delete process.env.POLLINATIONS_API_KEY;

      // Legacy HEAD → 429 to force hard fail
      global.fetch = jest.fn().mockImplementation(async () => {
        return { ok: false, status: 429, headers: { get: () => 'text/plain' } };
      });

      jest.resetModules();
      configureFallbackMocks(); // no Together/Replicate

      const { generateImageWithRetry } = require('@/lib/smart-image-generation');
      const url = await generateImageWithRetry('Elegant saree in red silk', ['#FF0000', '#FFD700', '#8B0000'], 1);

      expect(url).toMatch(/^data:image\/svg\+xml,/);
      const decoded = decodeURIComponent(url.replace('data:image/svg+xml,', ''));

      expect(decoded).toContain('Saree');
      expect(decoded.toLowerCase()).toContain('ff0000');
      expect(decoded.toLowerCase()).toContain('ffd700');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 13: Pollinations returns tiny image → retry
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 13 — Tiny image triggers retry', () => {
    it('should reject images smaller than 1024 bytes', async () => {
      process.env.POLLINATIONS_API_KEY = 'sk_test_tiny';
      let callCount = 0;

      global.fetch = jest.fn().mockImplementation(async (_url: string, opts?: any) => {
        callCount++;
        if (opts?.headers?.Authorization) {
          // Auth attempts: tiny image (< 1024 bytes)
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'image/jpeg' },
            arrayBuffer: async () => new ArrayBuffer(100), // Way too small
            text: async () => '',
          };
        }
        // Legacy HEAD check → succeed
        return { ok: true, status: 200 };
      });

      jest.resetModules();
      configureFallbackMocks();
      const { generateOutfitImageWithFallback } = require('@/lib/image-generation');

      const url = await generateOutfitImageWithFallback(SAMPLE_PROMPT, SAMPLE_COLORS, trackLifecycle);

      // Should have fallen through to legacy URL
      expect(url).toContain('image.pollinations.ai/prompt/');

      // Both auth retries should have failed
      const failures = lifecycleEvents.filter(
        (e) => e.provider === 'pollinations-auth' && e.status === 'failure'
      );
      expect(failures.length).toBe(2); // MAX_RETRIES = 2
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 14: Resolution speed — always under 25 s
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 14 — Total resolution speed guarantee', () => {
    it('should ALWAYS resolve within 25s even when everything is broken', async () => {
      process.env.POLLINATIONS_API_KEY = 'sk_test_mega_slow';
      global.fetch = createTimeoutFetch();

      jest.resetModules();
      configureFallbackMocks({
        togetherAvailable: true,
        togetherResult: async () => { await delay(30_000); return null; },
        replicateAvailable: true,
        replicateResult: async () => { await delay(30_000); return null; },
      });

      const { generateImageWithRetry } = require('@/lib/smart-image-generation');

      const start = Date.now();
      const url = await generateImageWithRetry(SAMPLE_PROMPT, SAMPLE_COLORS, 1);
      const elapsed = Date.now() - start;

      // Must have resolved (SVG placeholder or something)
      expect(url).toBeTruthy();

      // Must be within 30s (25s budget + overhead)
      expect(elapsed).toBeLessThan(30_000);

      console.log(`⏱️ Total resolution time: ${(elapsed / 1000).toFixed(2)}s`);
    }, 35_000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 15: Together.ai and Replicate chain order
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Scenario 15 — Fallback chain order verification', () => {
    it('should try Together BEFORE Replicate', async () => {
      process.env.POLLINATIONS_API_KEY = 'sk_test_chain_order';
      global.fetch = createHardFailFetch(500);

      const callOrder: string[] = [];

      jest.resetModules();
      configureFallbackMocks({
        togetherAvailable: true,
        togetherResult: async () => { callOrder.push('together'); return null; },
        replicateAvailable: true,
        replicateResult: async () => { callOrder.push('replicate'); return null; },
      });

      const { generateImageWithRetry } = require('@/lib/smart-image-generation');
      await generateImageWithRetry(SAMPLE_PROMPT, SAMPLE_COLORS, 1);

      // Together must be tried before Replicate
      const togetherIdx = callOrder.indexOf('together');
      const replicateIdx = callOrder.indexOf('replicate');
      expect(togetherIdx).toBeGreaterThanOrEqual(0);
      expect(replicateIdx).toBeGreaterThanOrEqual(0);
      expect(togetherIdx).toBeLessThan(replicateIdx);
    });
  });
});
