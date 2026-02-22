/**
 * Image Generation Service — Pollinations.ai Primary
 *
 * Uses the new gen.pollinations.ai unified API with optional API key authentication.
 * When POLLINATIONS_API_KEY is set, images are fetched server-side via Bearer auth
 * and returned as base64 data URIs — the key is NEVER exposed to the client.
 *
 * Fallback: legacy image.pollinations.ai URL approach (no key needed, less reliable).
 *
 * @see https://github.com/pollinations/pollinations/blob/main/APIDOCS.md
 */

// ─── Configuration ──────────────────────────────────────────────────────────
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;
const POLLINATIONS_GEN_URL = 'https://gen.pollinations.ai/image';
const POLLINATIONS_TIMEOUT = 8_000; // 8 s — klein model averages 3.5s, 8s gives safe headroom

// ─── Types ──────────────────────────────────────────────────────────────────
export interface ImageGenerationOptions {
  prompt: string;
  width?: number;
  height?: number;
}

export type ImageGenStatus = 'initiated' | 'in-progress' | 'success' | 'failure';

export interface ImageGenEvent {
  provider: string;
  status: ImageGenStatus;
  timestamp: number;
  duration?: number;
  error?: string;
}

/** Callback for lifecycle tracking (optional, defaults to console) */
export type LifecycleCallback = (event: ImageGenEvent) => void;

// ─── Default lifecycle logger ───────────────────────────────────────────────
const defaultLifecycle: LifecycleCallback = (e) => {
  const icon =
    e.status === 'initiated' ? '🚀' :
    e.status === 'in-progress' ? '⏳' :
    e.status === 'success' ? '✅' :
    '❌';
  const dur = e.duration ? ` (${(e.duration / 1000).toFixed(2)}s)` : '';
};

// ─── Helper: unique seed ────────────────────────────────────────────────────
function randomSeed(): number {
  return (Date.now() + Math.floor(Math.random() * 1_000_000)) % 999_999_999;
}

// ─── Image Validation ───────────────────────────────────────────────────────
/**
 * Extract width/height from JPEG or PNG image header bytes.
 * Returns null if the format is unrecognised.
 */
function getImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  // PNG: signature 89 50 4E 47, IHDR at offset 16
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    if (bytes.length >= 24) {
      const width  = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      return { width, height };
    }
  }

  // JPEG: scan for SOF0/SOF2 markers (FF C0 / FF C2)
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let offset = 2;
    while (offset < bytes.length - 9) {
      if (bytes[offset] !== 0xFF) { offset++; continue; }
      const marker = bytes[offset + 1];
      if (marker >= 0xC0 && marker <= 0xC3) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width  = (bytes[offset + 7] << 8) | bytes[offset + 8];
        return { width, height };
      }
      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + segmentLength;
    }
  }

  return null;
}

/**
 * Validate that an image buffer contains a real outfit image.
 *
 * Rejects:
 *   • Rate-limit poster images (square aspect ratio, e.g. 512×512)
 *   • Error pages or tiny placeholders (< 30 KB)
 *   • Wrong-dimension images (not portrait orientation)
 *
 * @throws Error if the image fails validation
 */
function validateOutfitImage(buffer: ArrayBuffer): void {
  // Check 1: Minimum size — real 768×1024 outfit images are ≥ 30 KB
  if (buffer.byteLength < 30_000) {
    throw new Error(`Image too small (${(buffer.byteLength / 1024).toFixed(1)} KB) — likely not a real outfit image`);
  }

  // Check 2: Parse dimensions from image header
  const dims = getImageDimensions(new Uint8Array(buffer));
  if (dims) {
    const { width, height } = dims;

    // Must be portrait orientation (height > width). Rate-limit posters are square.
    if (width > 0 && height > 0) {
      const aspectRatio = width / height;
      if (aspectRatio > 0.9) {
        throw new Error(
          `Image is square/landscape (${width}×${height}, ratio ${aspectRatio.toFixed(2)}) — expected portrait, likely a rate-limit poster`,
        );
      }

      // Must be at least 400×600
      if (width < 400 || height < 600) {
        throw new Error(`Image too small (${width}×${height}) — expected at least 400×600`);
      }
    }
  }
}

// ─── Strategy 1: Pollinations Authenticated (gen.pollinations.ai) ───────────
/**
 * Fetch image server-side using gen.pollinations.ai with Bearer auth.
 * Returns a base64 data URI — the API key never reaches the client.
 */
export async function generateWithPollinationsAuth(
  options: ImageGenerationOptions,
  onLifecycle: LifecycleCallback = defaultLifecycle,
  externalSignal?: AbortSignal,
): Promise<string> {
  if (!POLLINATIONS_API_KEY) {
    throw new Error('POLLINATIONS_API_KEY not configured');
  }
  if (externalSignal?.aborted) throw new Error('Cancelled by orchestrator');

  const { prompt, width = 768, height = 1024 } = options;
  const seed = randomSeed();
  const encodedPrompt = encodeURIComponent(prompt);

  const params = new URLSearchParams({
    model: 'klein',
    width: String(width),
    height: String(height),
    nologo: 'true',
    enhance: 'false',
    safe: 'true',
    seed: String(seed),
  });

  const url = `${POLLINATIONS_GEN_URL}/${encodedPrompt}?${params}`;

  onLifecycle({ provider: 'pollinations-auth', status: 'in-progress', timestamp: Date.now() });

  // Combine per-request timeout with external cancellation signal
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), POLLINATIONS_TIMEOUT);
  if (externalSignal) {
    const onAbort = () => { clearTimeout(timeoutId); controller.abort(); };
    externalSignal.addEventListener('abort', onAbort, { once: true });
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${POLLINATIONS_API_KEY}` },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Pollinations API ${response.status}: ${body.slice(0, 200)}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = await response.arrayBuffer();

  // Validate: catches rate-limit posters, error pages, wrong-dimension images
  validateOutfitImage(buffer);

  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${contentType};base64,${base64}`;
}

// ─── Prompt Enhancement ─────────────────────────────────────────────────────
/**
 * Negative constraints appended to EVERY image prompt.
 * Prevents FLUX models from rendering text, banners, logos, studio equipment.
 */
const NEGATIVE_CONSTRAINTS = 'absolutely no text, no words, no letters, no numbers, no banners, no logos, no watermarks, no labels, no overlays, no signs, no captions, no titles, no studio equipment visible, no cameras, no light stands, no promotional graphics, no borders, no frames';

/**
 * Enhance a fashion prompt for clean outfit visualization.
 *
 * Key design choices:
 *   1. Strip words FLUX models render as visible text ("Professional", "catalog",
 *      "magazine-ready", "8K quality") — these cause text overlays in generated images.
 *   2. Remove technical camera terms ("85mm lens", "depth of field") — these cause
 *      visible studio equipment (light stands, camera rigs) in the image.
 *   3. Replace person/model references with "mannequin" for consistent, clean display.
 *   4. Append strong negative constraints to suppress text, banners, logos, watermarks.
 */
export function enhancePromptForProfessionalQuality(prompt: string): string {
  // Step 1: Replace person/model references with mannequin
  let enhanced = prompt
    .replace(/\b(person|woman|man|model|individual|people)\b/gi, 'mannequin')
    .replace(/\b(he|she|they)\s+(wears?|stands?|poses?)/gi, 'displayed on mannequin')
    .replace(/confident\s+pose/gi, 'clean display')
    .replace(/standing\b/gi, 'displayed')
    .replace(/hair\s+styled[^.]*\./gi, '')
    .replace(/makeup[^.]*\./gi, '')
    .replace(/\bModel\b/g, 'Mannequin')
    .trim();

  // Step 2: Strip words that FLUX models render as visible text in the image
  enhanced = enhanced
    .replace(/\bprofessional\b/gi, '')
    .replace(/\b(fashion\s+)?catalog\b/gi, '')
    .replace(/\bhigh[- ]?end\s+retail\b/gi, '')
    .replace(/\bmagazine[- ]?ready\b/gi, '')
    .replace(/\b8k\s+(quality|resolution)\b/gi, '')
    .replace(/\beditorial[- ]?(quality|style|photography)?\b/gi, '')
    .replace(/\bluxury\s+brand\b/gi, '')
    // Strip technical camera terms that cause visible studio equipment
    .replace(/\bshot with \d+mm[^,.]*/gi, '')
    .replace(/\bshallow depth of field\b/gi, '')
    .replace(/\bcentered composition\b/gi, '')
    .replace(/\bvertical format\b/gi, '')
    .replace(/\bportrait lens\b/gi, '')
    // Clean up leftover whitespace
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

  // Step 3: Check if prompt already has lighting/background terms
  const hasSceneTerms = /studio lighting|soft.*light|white.*background|seamless.*backdrop/i.test(enhanced);

  if (hasSceneTerms) {
    return `${enhanced}, ${NEGATIVE_CONSTRAINTS}`;
  }

  // Step 4: Wrap in a standardized scene description
  const prefix = 'Fashion product photograph, full-body outfit displayed on plain white mannequin, front-facing centered view, ';
  const suffix = `. Soft even studio lighting, clean white seamless background, high resolution, sharp focus, photorealistic, ${NEGATIVE_CONSTRAINTS}`;
  return `${prefix}${enhanced.replace(/\.$/, '')}${suffix}`;
}

// ─── Main Entry Point ───────────────────────────────────────────────────────
/**
 * Generate an outfit image using Pollinations.ai with multi-strategy fallback.
 *
 * Single-strategy design (2026-02-10 overhaul):
 *   • Auth endpoint only — 4 s timeout, fail fast.
 *   • Legacy URL removed: it always returned rate-limit posters and wasted 6–10 s.
 *   • Returns null on failure — orchestrator decides fallback.
 *
 * Called by smart-image-generation.ts as one provider in the
 * wider fallback chain (Pollinations → Together → Replicate → SVG placeholder).
 */
export async function generateOutfitImageWithFallback(
  prompt: string,
  colorHexCodes: string[],
  onLifecycle: LifecycleCallback = defaultLifecycle,
  signal?: AbortSignal,
): Promise<string | null> {
  const start = Date.now();
  const enhanced = enhancePromptForProfessionalQuality(prompt);
  const options: ImageGenerationOptions = { prompt: enhanced, width: 768, height: 1024 };

  // Single attempt: Pollinations authenticated (4 s timeout)
  if (POLLINATIONS_API_KEY && !signal?.aborted) {
    try {
      onLifecycle({ provider: 'pollinations-auth', status: 'initiated', timestamp: Date.now() });
      const url = await generateWithPollinationsAuth(options, onLifecycle, signal);
      const dur = Date.now() - start;
      onLifecycle({ provider: 'pollinations-auth', status: 'success', timestamp: Date.now(), duration: dur });
      return url;
    } catch (err: any) {
      const dur = Date.now() - start;
      onLifecycle({ provider: 'pollinations-auth', status: 'failure', timestamp: Date.now(), duration: dur, error: err.message });
    }
  }

  // Return null — orchestrator handles Together/Replicate/SVG fallback
  return null;
}

/**
 * Check if Pollinations.ai is available (authenticated mode preferred).
 */
export function isPollinationsAvailable(): boolean {
  return true; // Always available — auth mode or legacy URL mode
}

/**
 * Check if Pollinations.ai has an API key configured (authenticated mode).
 */
export function isPollinationsAuthenticated(): boolean {
  return !!POLLINATIONS_API_KEY;
}
