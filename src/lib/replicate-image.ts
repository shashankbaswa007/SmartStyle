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
const MAX_RETRIES = 3;
const POLL_INTERVAL = 1000; // 1 second
const MAX_WAIT_TIME = 30000; // 30 seconds

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
    console.warn('⚠️ [REPLICATE] API token not configured, skipping...');
    return null;
  }

  try {
    console.log('🎨 [REPLICATE] Starting premium image generation...');
    
    // Enhance prompt with colors
    const colorList = colors.map(c => c.replace('#', '')).join(', ');
    const enhancedPrompt = `${prompt}, featuring colors: ${colorList}, high quality fashion photography, professional lighting, detailed textures, 8k resolution`;

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
      throw new Error(`Replicate API error: ${createResponse.statusText}`);
    }

    const prediction: ReplicatePrediction = await createResponse.json();
    console.log(`🔄 [REPLICATE] Prediction created: ${prediction.id}`);

    // Poll for completion
    const startTime = Date.now();
    let attempts = 0;
    
    while (attempts < MAX_RETRIES) {
      if (Date.now() - startTime > MAX_WAIT_TIME) {
        console.warn('⏱️ [REPLICATE] Timeout waiting for image generation');
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
        console.log('✅ [REPLICATE] Image generated successfully');
        return status.output[0];
      }
      
      if (status.status === 'failed' || status.status === 'canceled') {
        console.error('❌ [REPLICATE] Generation failed:', status.error);
        return null;
      }
      
      // Still processing, continue polling
      attempts++;
    }

    console.warn('⚠️ [REPLICATE] Max retries reached');
    return null;

  } catch (error) {
    console.error('❌ [REPLICATE] Error generating image:', error);
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
