/**
 * Together.ai Image Generation Client
 * 
 * Uses Together.ai's FLUX-schnell model for fast, high-quality image generation.
 * Free tier: ~60 image generations per day (no credit card required).
 * Cost on paid: ~$0.001 per image — much cheaper than Gemini.
 *
 * Setup: Set TOGETHER_API_KEY in your .env.local
 * Get a free key at https://api.together.xyz
 */

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const TOGETHER_API_URL = 'https://api.together.xyz/v1/images/generations';
const REQUEST_TIMEOUT = 5000; // 5 seconds — must fit within 8s per-outfit budget

interface TogetherImageResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

/**
 * Generate an image using Together.ai FLUX-schnell model.
 * Returns the image URL on success, null on failure.
 */
export async function generateWithTogether(
  prompt: string,
  colors: string[]
): Promise<string | null> {
  if (!TOGETHER_API_KEY) {
    console.warn('⚠️ [TOGETHER] API key not configured, skipping...');
    return null;
  }

  try {
    console.log('🎨 [TOGETHER] Starting image generation...');

    // Enhance prompt with color context for fashion relevance
    const colorList = colors
      .filter(c => c && c !== '#000000' && c !== '#FFFFFF')
      .map(c => c.replace('#', ''))
      .slice(0, 4)
      .join(', ');

    const enhancedPrompt = [
      prompt,
      colorList ? `featuring colors: #${colorList}` : '',
      'fashion product photograph, soft studio lighting, clean white background, high quality, detailed textures, photorealistic',
      'absolutely no text, no words, no letters, no banners, no logos, no watermarks, no overlays, no studio equipment visible',
    ]
      .filter(Boolean)
      .join(', ');

    const response = await fetch(TOGETHER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        prompt: enhancedPrompt,
        width: 768,
        height: 1024,
        steps: 4,
        n: 1,
        response_format: 'url',
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      console.warn(`⚠️ [TOGETHER] API error ${response.status}: ${errorText}`);
      return null;
    }

    const data: TogetherImageResponse = await response.json();

    const imageUrl = data?.data?.[0]?.url;
    if (imageUrl) {
      console.log('✅ [TOGETHER] Image generated successfully');
      return imageUrl;
    }

    // Handle base64 response as fallback
    const b64 = data?.data?.[0]?.b64_json;
    if (b64) {
      console.log('✅ [TOGETHER] Image generated (base64)');
      return `data:image/png;base64,${b64}`;
    }

    console.warn('⚠️ [TOGETHER] No image URL in response');
    return null;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      console.warn('⏱️ [TOGETHER] Request timed out');
    } else {
      console.error('❌ [TOGETHER] Error:', error);
    }
    return null;
  }
}

/**
 * Check if Together.ai is available and configured
 */
export function isTogetherAvailable(): boolean {
  return !!TOGETHER_API_KEY;
}
