/**
 * Smart Image Generation — Unified Orchestrator
 *
 * Single entry point for all outfit image generation across the app.
 * Manages the full fallback chain with throttling, deduplication,
 * lifecycle tracking, and per-provider timeouts.
 *
 * Fallback chain (sequential, never parallel):
 *   1. Pollinations.ai (auth, klein model)  — PRIMARY   (8 s timeout)
 *   2. Together.ai FLUX-schnell            — FALLBACK  (free tier, 5 s)
 *   3. Replicate FLUX-schnell              — FALLBACK  (paid, circuit-breaker)
 *   4. Gradient SVG placeholder            — FINAL     (instant, zero-cost)
 *
 * Guardrails:
 *   • Max 3 concurrent image generation requests
 *   • In-flight deduplication — same prompt reuses the pending promise
 *   • Total timeout cap: 15 s — Pollinations is primary, needs time to generate
 *   • Session-level circuit breaker for Replicate (402/429 disables for session)
 *   • AbortController cancellation — ghost promises are killed when budget expires
 */

import {
  generateOutfitImageWithFallback,
  enhancePromptForProfessionalQuality,
  type ImageGenEvent,
  type LifecycleCallback,
} from './image-generation';
import { generateWithTogether, isTogetherAvailable } from './together-image';
import { generateWithReplicate, isReplicateAvailable } from './replicate-image';

// ─── Throttle / Deduplication State ─────────────────────────────────────────
let activeRequests = 0;
const MAX_CONCURRENT = 3;
const inflightRequests = new Map<string, Promise<string>>();
const TOTAL_TIMEOUT = 12_000; // 12 s — klein model averages 3.5s, 12s is plenty for full chain

// ─── Session Circuit Breakers ──────────────────────────────────────────
let replicateDisabledUntil = 0; // Epoch ms — skip Replicate until this time
let pollinationsDisabledUntil = 0; // Epoch ms — skip Pollinations after timeout (30s cooldown)

// ─── Dedup key generator ────────────────────────────────────────────────────
function dedupKey(prompt: string, colors: string[]): string {
  const norm = prompt.toLowerCase().trim().slice(0, 120);
  const colorsKey = colors.slice(0, 4).sort().join(',');
  return `${norm}::${colorsKey}`;
}

// ─── Lifecycle event list (per-request) ─────────────────────────────────────
export type { ImageGenEvent, LifecycleCallback };

// ─── Main Public API ────────────────────────────────────────────────────────
/**
 * Generate an outfit image using the full provider chain.
 *
 * @param prompt - Description of the outfit to generate.
 * @param colors - Hex colour codes (e.g. ['#FF6B35', '#004E89']).
 * @returns      - Image URL, data URI, or SVG placeholder.
 */
export async function generateImageWithRetry(
  prompt: string,
  colors: string[],
  maxBudgetMs?: number,
): Promise<string> {
  // ── Deduplication: reuse in-flight request for identical prompt+colors ───
  const key = dedupKey(prompt, colors);
  const existing = inflightRequests.get(key);
  if (existing) {
    console.log('♻️ [IMG] Reusing in-flight request for identical prompt');
    return existing;
  }

  // ── Throttle: wait until a slot opens ─────────────────────────────────────
  if (activeRequests >= MAX_CONCURRENT) {
    console.log(`⏳ [IMG] Throttled — ${activeRequests}/${MAX_CONCURRENT} active, waiting...`);
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (activeRequests < MAX_CONCURRENT) {
          clearInterval(check);
          resolve();
        }
      }, 200);
      // Safety: don't wait forever
      setTimeout(() => { clearInterval(check); resolve(); }, 5_000);
    });
  }

  activeRequests++;
  const events: ImageGenEvent[] = [];
  const onLifecycle: LifecycleCallback = (e) => {
    events.push(e);
    const icon =
      e.status === 'initiated' ? '🚀' :
      e.status === 'in-progress' ? '⏳' :
      e.status === 'success' ? '✅' : '❌';
    const dur = e.duration ? ` (${(e.duration / 1000).toFixed(2)}s)` : '';
    console.log(`${icon} [IMG] ${e.provider} → ${e.status}${dur}${e.error ? ' — ' + e.error : ''}`);
  };

  const promise = _generateWithChain(prompt, colors, onLifecycle, maxBudgetMs);

  // Store in dedup map and clean up when done
  inflightRequests.set(key, promise);
  promise.finally(() => {
    activeRequests = Math.max(0, activeRequests - 1);
    inflightRequests.delete(key);
  });

  return promise;
}

// ─── Internal: provider chain with total timeout ────────────────────────────
async function _generateWithChain(
  prompt: string,
  colors: string[],
  onLifecycle: LifecycleCallback,
  maxBudgetMs?: number,
): Promise<string> {
  const chainStart = Date.now();
  const effectiveTimeout = maxBudgetMs ? Math.min(TOTAL_TIMEOUT, maxBudgetMs) : TOTAL_TIMEOUT;

  const elapsed = () => Date.now() - chainStart;
  const budgetLeft = () => effectiveTimeout - elapsed();

  console.log(`🎨 [IMG] Starting image generation chain (${(effectiveTimeout / 1000).toFixed(1)}s budget)...`);

  // ── Provider 1: Pollinations.ai (turbo model, 10 s, circuit breaker) ─────────
  const pollinationsAllowed = Date.now() > pollinationsDisabledUntil;
  if (!pollinationsAllowed) {
    console.log('🛡️ [IMG] Pollinations skipped (circuit breaker active — recent timeout)');
  }
  if (budgetLeft() > 2000 && pollinationsAllowed) {
    const pollinationsController = new AbortController();
    try {
      onLifecycle({ provider: 'pollinations', status: 'initiated', timestamp: Date.now() });
      const url = await withBudget(
        generateOutfitImageWithFallback(prompt, colors, onLifecycle, pollinationsController.signal),
        Math.min(budgetLeft(), 10_000), // 10 s — Pollinations is primary, needs 5-10s
        pollinationsController,
      );
      if (url) {
        onLifecycle({ provider: 'pollinations', status: 'success', timestamp: Date.now(), duration: elapsed() });
        return url;
      }
    } catch (err: any) {
      pollinationsController.abort();
      onLifecycle({ provider: 'pollinations', status: 'failure', timestamp: Date.now(), duration: elapsed(), error: err.message });
      // Circuit breaker: only trip on auth errors (401/403), NOT on timeouts
      // Pollinations is the sole provider — don't disable it for slow responses
      if (err.message?.includes('401') || err.message?.includes('403')) {
        pollinationsDisabledUntil = Date.now() + 60_000;
        console.log('🛡️ [IMG] Pollinations circuit breaker tripped (auth error) — disabled for 60s');
      }
    }
  }

  // ── Provider 2: Together.ai FLUX-schnell (single attempt) ─────────────────
  if (!isTogetherAvailable()) {
    console.log('⚠️ [IMG] Together.ai skipped — TOGETHER_API_KEY not configured');
  } else if (budgetLeft() <= 1000) {
    console.log('⚠️ [IMG] Together.ai skipped — insufficient budget');
  }
  if (budgetLeft() > 1000 && isTogetherAvailable()) {
    try {
      onLifecycle({ provider: 'together', status: 'initiated', timestamp: Date.now() });
      const url = await withBudget(
        generateWithTogether(prompt, colors),
        Math.min(budgetLeft(), 5_000),
      );
      if (url) {
        onLifecycle({ provider: 'together', status: 'success', timestamp: Date.now(), duration: elapsed() });
        return url;
      }
    } catch (err: any) {
      onLifecycle({ provider: 'together', status: 'failure', timestamp: Date.now(), duration: elapsed(), error: err.message });
    }
  }

  // ── Provider 3: Replicate (circuit breaker: skip if 402/429 in last 10 min)
  const replicateAllowed = isReplicateAvailable() && Date.now() > replicateDisabledUntil;
  if (budgetLeft() > 2000 && replicateAllowed) {
    try {
      onLifecycle({ provider: 'replicate', status: 'initiated', timestamp: Date.now() });
      const url = await withBudget(
        generateWithReplicate(prompt, colors),
        Math.min(budgetLeft(), 8_000),
      );
      if (url) {
        onLifecycle({ provider: 'replicate', status: 'success', timestamp: Date.now(), duration: elapsed() });
        return url;
      }
    } catch (err: any) {
      onLifecycle({ provider: 'replicate', status: 'failure', timestamp: Date.now(), duration: elapsed(), error: err.message });
      // Circuit breaker: disable Replicate for 10 minutes on payment/rate errors
      if (err.message?.includes('402') || err.message?.includes('429') || err.message?.includes('credits')) {
        replicateDisabledUntil = Date.now() + 10 * 60 * 1000;
        console.log('🛡️ [IMG] Replicate circuit breaker tripped — disabled for 10 min');
      }
    }
  } else if (!replicateAllowed && isReplicateAvailable()) {
    console.log('🛡️ [IMG] Replicate skipped (circuit breaker active)');
  }

  // ── Final fallback: gradient SVG placeholder (instant) ────────────────────
  console.log('📦 [IMG] All providers exhausted — using SVG placeholder');
  onLifecycle({ provider: 'svg-placeholder', status: 'success', timestamp: Date.now(), duration: elapsed() });
  return createFallbackPlaceholder(prompt, colors);
}

// ─── Timeout wrapper for budget enforcement ─────────────────────────────────
function withBudget<T>(promise: Promise<T>, budgetMs: number, controller?: AbortController): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller?.abort(); // Cancel in-flight fetches — prevents ghost promise leaks
      reject(new Error(`Budget exceeded (${budgetMs}ms)`));
    }, budgetMs);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ─── SVG Gradient Placeholder ───────────────────────────────────────────────
export function createFallbackPlaceholder(prompt: string, colors: string[]): string {
  const fashionTerms = prompt.match(
    /\b(kurta|saree|dress|outfit|shirt|pants|jacket|coat|blazer|skirt|suit|gown|shorts|lehenga|top|jeans)\b/gi,
  );
  const placeholderText = fashionTerms
    ? fashionTerms[0].charAt(0).toUpperCase() + fashionTerms[0].slice(1).toLowerCase()
    : 'Outfit';

  const sanitize = (c: string, fallback: string): string => {
    const hex = c?.replace('#', '') || fallback;
    return /^[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
  };

  const c1 = sanitize(colors[0], '6366f1');
  const c2 = sanitize(colors[1], 'a78bfa');
  const c3 = sanitize(colors[2], 'c4b5fd');
  const c4 = sanitize(colors[3], 'ede9fe');

  const hangerIcon =
    'M400 260 C400 230, 370 210, 340 210 C310 210, 300 230, 300 240 L300 250 ' +
    'M300 250 L180 370 C160 387, 170 410, 195 410 L605 410 C630 410, 640 387, 620 370 L500 250 ' +
    'M300 250 L500 250';

  const svg = `<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#${c1}" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="#${c2}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#${c3}" stop-opacity="0.9"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#bg)"/>
  <rect width="800" height="1000" fill="url(#glow)"/>
  <circle cx="340" cy="600" r="28" fill="#${c1}" stroke="white" stroke-width="3" opacity="0.9"/>
  <circle cx="400" cy="600" r="28" fill="#${c2}" stroke="white" stroke-width="3" opacity="0.9"/>
  <circle cx="460" cy="600" r="28" fill="#${c3}" stroke="white" stroke-width="3" opacity="0.9"/>
  <path d="${hangerIcon}" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
  <text x="400" y="500" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="600" fill="white" text-anchor="middle" opacity="0.95">${placeholderText}</text>
  <text x="400" y="680" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="white" text-anchor="middle" opacity="0.55">Image generation unavailable</text>
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
