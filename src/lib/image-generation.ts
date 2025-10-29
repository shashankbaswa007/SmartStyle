/**
 * Image Generation Service
 * Uses multiple providers with fallback strategy for reliable image generation
 */

interface ImageGenerationOptions {
  prompt: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
}

/**
 * Generate image using Pollinations AI (free, no API key required)
 * Uses Flux model for high-quality fashion images
 * Returns URL immediately - image generates on-demand when accessed
 */
async function generateWithPollinations(options: ImageGenerationOptions): Promise<string> {
  const { prompt, width = 800, height = 1000 } = options;
  
  // Add seed for uniqueness and randomness for variety
  const seed = Date.now() + Math.floor(Math.random() * 10000);
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&enhance=true&model=flux&seed=${seed}`;
  
  console.log('🎨 Pollinations AI - URL generated instantly');
  console.log('📝 Prompt:', prompt.substring(0, 100) + '...');
  console.log('🔗 Image URL:', url.substring(0, 100) + '...');
  console.log('ℹ️  Image will generate on-demand when accessed by browser');
  
  // Pollinations generates images on-demand, no need to validate
  // The URL format is predictable and reliable
  return url;
}

/**
 * Generate image using Hugging Face Inference API (requires API key)
 * Fallback option if Pollinations fails
 * Following the official HuggingFace API pattern
 */
async function generateWithHuggingFace(options: ImageGenerationOptions): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY not configured');
  }

  console.log('🎨 Generating with Hugging Face');
  console.log('🔑 API Key loaded:', apiKey.substring(0, 10) + '...');

  // Try multiple models in order of preference (only working models)
  const models = [
    'black-forest-labs/FLUX.1-schnell', // ✅ Working - Fast and high quality
    'stabilityai/stable-diffusion-xl-base-1.0', // ✅ Working - High quality
  ];

  for (const model of models) {
    try {
      console.log(`🔄 Trying model: ${model}`);
      
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: options.prompt, // ✅ Correct: Only "inputs" parameter
          }),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ Model ${model} failed (${response.status}):`, errorText.substring(0, 200));
        continue; // Try next model
      }

      console.log('✅ Response received, processing image...');

      const blob = await response.blob();
      
      if (blob.size === 0) {
        console.warn(`⚠️ Empty image blob from ${model}`);
        continue; // Try next model
      }

      console.log(`✅ Image blob received: ${blob.size} bytes from ${model}`);
      
      // Convert blob to base64 data URL for Next.js Image component
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('✅ HuggingFace image generated successfully');
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          console.error('❌ Failed to convert blob to data URL');
          reject(new Error('Failed to convert image blob to data URL'));
        };
        reader.readAsDataURL(blob);
      });

    } catch (modelError) {
      console.warn(`⚠️ Model ${model} error:`, modelError);
      continue; // Try next model
    }
  }

  throw new Error('All HuggingFace models failed');
}

/**
 * Generate outfit image with multi-provider fallback strategy
 * 
 * Priority:
 * 1. Pollinations AI (free, no API key)
 * 2. Hugging Face (requires API key)
 * 3. Placeholder (final fallback)
 * 
 * @param prompt - Detailed description of the outfit to generate
 * @param colorHexCodes - Array of color hex codes for the outfit
 * @returns URL or data URI of the generated image
 */
export async function generateOutfitImageWithFallback(
  prompt: string,
  colorHexCodes: string[]
): Promise<string> {
  const startTime = Date.now();
  console.log('🎨 Starting image generation with fallback strategy');
  console.log('📝 Prompt:', prompt.substring(0, 150) + '...');
  console.log('🎨 Colors:', colorHexCodes);

  const options: ImageGenerationOptions = {
    prompt,
    width: 800,
    height: 1000,
  };

  // Strategy 1: Try Pollinations (free, instant URL generation)
  try {
    console.log('🔄 Strategy 1: Pollinations AI (instant URL generation)');
    const imageUrl = await generateWithPollinations(options);
    const duration = ((Date.now() - startTime) / 1000).toFixed(3);
    console.log(`✅ Pollinations URL generated in ${duration}s!`);
    return imageUrl;
  } catch (pollinationsError) {
    console.warn('⚠️ Pollinations failed:', pollinationsError);
  }

  // Strategy 2: Try HuggingFace if API key is available
  if (process.env.HUGGINGFACE_API_KEY) {
    try {
      console.log('🔄 Fallback: Trying Hugging Face API...');
      const imageUrl = await generateWithHuggingFace(options);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ HuggingFace successful in ${duration}s!`);
      return imageUrl;
    } catch (hfError) {
      console.warn('⚠️ HuggingFace failed:', hfError);
    }
  } else {
    console.log('ℹ️ HUGGINGFACE_API_KEY not configured, skipping HuggingFace');
  }

  // Strategy 3: Fallback to placeholder
  console.log('⚠️ All image generation methods failed, using placeholder');
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`ℹ️ Using placeholder after ${duration}s`);
  const placeholderUrl = `https://via.placeholder.com/800x1000/6366f1/ffffff?text=${encodeURIComponent('Fashion Outfit')}`;
  return placeholderUrl;
}
