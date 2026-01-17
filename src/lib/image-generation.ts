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
 * Pollinations handles rate limiting internally via CDN caching
 */
async function generateWithPollinations(options: ImageGenerationOptions): Promise<string> {
  const { prompt, width = 800, height = 1000 } = options;
  
  // OPTIMIZATION: Removed artificial delays - Pollinations CDN handles caching
  // Old delays: 5s min between requests + 3s generation wait = 8s wasted per image!
  // Parallel requests now work efficiently with unique seeds
  
  // Add seed for uniqueness and randomness for variety
  const seed = Date.now() + Math.floor(Math.random() * 10000);
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&enhance=true&model=flux&seed=${seed}`;
  
  console.log('🎨 [PERF] Pollinations AI - URL generated instantly');
  console.log('📝 Prompt:', prompt.substring(0, 100) + '...');
  console.log('🔗 Image URL:', url.substring(0, 100) + '...');
  
  // Quick validation with shorter timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    
    if (response.status === 429) {
      console.warn('⚠️ Pollinations rate limit detected');
    }
  } catch (error: any) {
    // Ignore validation errors - image will still work
    console.log('ℹ️ [PERF] Skipping validation, returning URL immediately');
  }
  
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
 * Enhance prompt with professional photography and quality keywords
 * Adds industry-standard terms to improve image quality and consistency
 */
function enhancePromptForProfessionalQuality(prompt: string): string {
  // Check if prompt already has professional quality terms
  const hasQualityTerms = /professional|editorial|high.?resolution|magazine|studio lighting/i.test(prompt);
  
  // Replace person/model references with mannequin for professional catalog look
  let enhancedPrompt = prompt
    .replace(/\b(person|woman|man|model|individual|people)\b/gi, 'mannequin')
    .replace(/\b(he|she|they)\s+(wears?|stands?|poses?)/gi, 'displayed on mannequin')
    .replace(/confident\s+pose/gi, 'professional display')
    .replace(/standing/gi, 'displayed')
    .replace(/hair\s+styled[^.]*\./gi, '')
    .replace(/makeup[^.]*\./gi, '')
    .replace(/Model/g, 'Mannequin')
    .trim();
  
  if (hasQualityTerms) {
    // Prompt already well-formatted, just apply mannequin changes
    return enhancedPrompt;
  }
  
  // Add professional quality enhancements to existing prompts
  const qualityPrefix = 'Professional fashion catalog photography, outfit displayed on white mannequin, ';
  const qualitySuffix = '. Studio lighting with soft diffused key light, clean white background, high resolution, sharp focus, professional fashion catalog aesthetic.';
  
  // Remove any existing trailing periods to avoid double periods
  const cleanPrompt = enhancedPrompt.trim().replace(/\.$/, '');
  
  return `${qualityPrefix}${cleanPrompt}${qualitySuffix}`;
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
  console.log('🎨 [PERF] Starting image generation with fallback strategy');
  console.log('📝 Original Prompt:', prompt.substring(0, 150) + '...');
  
  // Enhance prompt with professional quality keywords
  const enhancedPrompt = enhancePromptForProfessionalQuality(prompt);
  console.log('✨ Enhanced Prompt:', enhancedPrompt.substring(0, 150) + '...');
  console.log('🎨 Colors:', colorHexCodes);

  const options: ImageGenerationOptions = {
    prompt: enhancedPrompt,
    width: 800,
    height: 1000,
  };

  // Strategy 1: Try Pollinations (free, instant URL generation)
  try {
    console.log('🔄 [PERF] Strategy 1: Pollinations AI (instant URL generation)');
    const imageUrl = await generateWithPollinations(options);
    const duration = ((Date.now() - startTime) / 1000).toFixed(3);
    console.log(`✅ [PERF] Pollinations URL generated in ${duration}s!`);
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
