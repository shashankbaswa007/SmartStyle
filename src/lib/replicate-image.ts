/**
 * Replicate Image Generation
 * 
 * Premium image generation using Replicate's FLUX model
 * Used for position 1 (most important outfit) only
 * 
 * Cost: ~$0.003 per image
 * Quality: Excellent (better than Pollinations.ai)
 */

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const MAX_RETRIES = 6;
const POLL_INTERVAL = 1000; // 1 second
const MAX_WAIT_TIME = 7000; // 7 seconds — must fit within 8s per-outfit budget

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string[];
  error?: string;
}

/**
 * Generate image using Replicate FLUX-schnell model
 * Fast, high-quality fashion imagery
 */
export async function generateWithReplicate(
  prompt: string,
  colors: string[]
): Promise<string | null> {
  if (!REPLICATE_API_TOKEN) {
    return null;
  }

  try {
    
    // Enhance prompt with colors
    const colorList = colors.map(c => c.replace('#', '')).join(', ');
    const enhancedPrompt = `${prompt}, featuring colors: ${colorList}, fashion product photograph, soft studio lighting, clean white background, detailed textures, high resolution, photorealistic, absolutely no text no words no letters no banners no logos no watermarks no overlays`;

    // Create prediction
    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'black-forest-labs/flux-schnell', // Fast FLUX model
        input: {
          prompt: enhancedPrompt,
          num_outputs: 1,
          aspect_ratio: '5:8', // Portrait for outfit
          output_format: 'jpg',
          output_quality: 90,
        },
      }),
    });

    if (!createResponse.ok) {
      // 402 Payment Required = no credits — throw so circuit breaker trips
      if (createResponse.status === 402) {
        throw new Error('Replicate API error: 402 Payment Required — no credits');
      }
      // 429 Too Many Requests — skip immediately, circuit breaker will handle
      if (createResponse.status === 429) {
        throw new Error('Replicate API error: 429 Too Many Requests');
      }
      throw new Error(`Replicate API error: ${createResponse.status} ${createResponse.statusText}`);
    }

    const prediction: ReplicatePrediction = await createResponse.json();

    // Poll for completion
    const startTime = Date.now();
    let attempts = 0;
    
    while (attempts < MAX_RETRIES) {
      if (Date.now() - startTime > MAX_WAIT_TIME) {
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          },
        }
      );

      if (!statusResponse.ok) {
        attempts++;
        continue;
      }

      const status: ReplicatePrediction = await statusResponse.json();
      
      if (status.status === 'succeeded' && status.output && status.output[0]) {
        return status.output[0];
      }
      
      if (status.status === 'failed' || status.status === 'canceled') {
        return null;
      }
      
      // Still processing, continue polling
      attempts++;
    }

    return null;

  } catch (error: any) {
    // Re-throw 402/429 so the circuit breaker in smart-image-generation.ts can trip
    if (error?.message?.includes('402') || error?.message?.includes('429')) {
      throw error;
    }
    return null;
  }
}

/**
 * Check if Replicate is available and configured
 */
export function isReplicateAvailable(): boolean {
  return !!REPLICATE_API_TOKEN;
}

/**
 * Get estimated cost for Replicate usage
 */
export function getEstimatedCost(imageCount: number): number {
  const COST_PER_IMAGE = 0.003; // $0.003 per image
  return imageCount * COST_PER_IMAGE;
}
