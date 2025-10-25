/**
 * Pollinations.ai - FREE AI image generation (no API key needed!)
 * Uses Stable Diffusion via simple URL-based API
 * Perfect fallback for outfit visualization when Gemini quota is exceeded
 */

export interface PollinationsImage {
  url: string;
  source: 'pollinations';
}

/**
 * Generate outfit image using Pollinations.ai
 * No API key required - works via URL parameters
 */
export async function generateImageWithPollinations(
  description: string
): Promise<PollinationsImage | null> {
  try {
    console.log('🎨 Generating image with Pollinations.ai (FREE, no key needed)...');

    // Extract fashion keywords for better prompts
    const fashionPrompt = buildFashionPrompt(description);
    
    // Generate unique seed for variety
    const seed = Math.floor(Math.random() * 1000000);
    
    // Pollinations.ai URL - no API key, just URL parameters!
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fashionPrompt)}?width=768&height=1024&seed=${seed}&nologo=true&enhance=true&model=flux`;

    console.log('✅ Generated Pollinations.ai image URL');
    
    return {
      url: imageUrl,
      source: 'pollinations',
    };
  } catch (error) {
    console.error('❌ Pollinations.ai error:', error);
    return null;
  }
}

/**
 * Build optimized prompt for fashion image generation
 */
function buildFashionPrompt(description: string): string {
  // Remove generic phrases
  let cleanPrompt = description
    .replace(/a photorealistic image of/gi, '')
    .replace(/photorealistic/gi, '')
    .replace(/image of/gi, '')
    .replace(/mannequin wearing/gi, 'person wearing')
    .replace(/on a mannequin/gi, '')
    .trim();

  // Enhance with fashion photography keywords
  const enhancedPrompt = `professional fashion photography, full body shot, ${cleanPrompt}, studio lighting, high quality, detailed, sharp focus, 8K, fashion magazine style, clean background`;

  return enhancedPrompt;
}

/**
 * Generate multiple variations with different seeds
 */
export function generatePollinationsVariations(
  description: string,
  count: number = 3
): PollinationsImage[] {
  const fashionPrompt = buildFashionPrompt(description);
  const images: PollinationsImage[] = [];

  for (let i = 0; i < count; i++) {
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fashionPrompt)}?width=768&height=1024&seed=${seed}&nologo=true&enhance=true&model=flux`;
    
    images.push({
      url: imageUrl,
      source: 'pollinations',
    });
  }

  return images;
}

/**
 * Check if Pollinations.ai is available (always true - no key needed!)
 */
export function isPollinationsAvailable(): boolean {
  return true; // Always available, no API key required!
}
