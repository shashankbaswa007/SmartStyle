import { generateWithTogether, isTogetherAvailable } from './together-image';

/**
 * Smart image generation with tiered fallback strategy:
 *   1. Together.ai FLUX-schnell (free tier, ~60/day — fast, high quality)
 *   2. Beautiful gradient SVG placeholder (zero-cost, instant)
 *
 * Replicate is handled separately in the recommend route as a premium tier.
 */
export async function generateImageWithRetry(
  prompt: string,
  colors: string[],
  maxRetries: number = 2
): Promise<string> {
  console.log('🎨 Starting image generation with fallbacks...');

  // Strategy 1: Together.ai (free tier, FLUX-schnell)
  if (isTogetherAvailable()) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 [Attempt ${attempt}/${maxRetries}] Trying Together.ai FLUX-schnell...`);
        const url = await generateWithTogether(prompt, colors);
        if (url) {
          console.log('✅ Image generated successfully with Together.ai');
          return url;
        }
      } catch (error) {
        console.warn(`⚠️ Together.ai attempt ${attempt} failed:`, error);
      }
    }
  }

  // Final fallback: beautiful gradient SVG placeholder
  console.log('📦 Using enhanced placeholder with fashion colors');
  return createEnhancedPlaceholder(prompt, colors);
}

function createEnhancedPlaceholder(prompt: string, colors: string[]): string {
  // Extract key fashion terms from prompt for placeholder text
  const fashionTerms = prompt.match(
    /\b(kurta|saree|dress|outfit|shirt|pants|jacket|coat|blazer|skirt|suit|gown|shorts|lehenga|top|jeans)\b/gi
  );
  const placeholderText = fashionTerms
    ? fashionTerms[0].charAt(0).toUpperCase() + fashionTerms[0].slice(1).toLowerCase()
    : 'Outfit';

  // Sanitise and prepare up to 4 hex colours
  const sanitize = (c: string, fallback: string): string => {
    const hex = c?.replace('#', '') || fallback;
    return /^[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
  };

  const c1 = sanitize(colors[0], '6366f1');
  const c2 = sanitize(colors[1], 'a78bfa');
  const c3 = sanitize(colors[2], 'c4b5fd');
  const c4 = sanitize(colors[3], 'ede9fe');

  // Hanger icon path (simple, elegant)
  const hangerIcon =
    "M400 260 C400 230, 370 210, 340 210 C310 210, 300 230, 300 240 L300 250 " +
    "M300 250 L180 370 C160 387, 170 410, 195 410 L605 410 C630 410, 640 387, 620 370 L500 250 " +
    "M300 250 L500 250";

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
  <!-- colour swatches -->
  <circle cx="340" cy="600" r="28" fill="#${c1}" stroke="white" stroke-width="3" opacity="0.9"/>
  <circle cx="400" cy="600" r="28" fill="#${c2}" stroke="white" stroke-width="3" opacity="0.9"/>
  <circle cx="460" cy="600" r="28" fill="#${c3}" stroke="white" stroke-width="3" opacity="0.9"/>
  <!-- hanger icon -->
  <path d="${hangerIcon}" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
  <!-- text -->
  <text x="400" y="500" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="600" fill="white" text-anchor="middle" opacity="0.95">${placeholderText}</text>
  <text x="400" y="680" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="white" text-anchor="middle" opacity="0.55">Image generation unavailable</text>
</svg>`;

  // Encode to data URI (encodeURIComponent is more robust than manual escaping)
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
