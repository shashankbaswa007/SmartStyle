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
 * Includes retry logic for rate limiting
 */
async function generateWithPollinations(options: ImageGenerationOptions, retryCount = 0): Promise<string> {
  const { prompt, width = 800, height = 1000 } = options;
  const maxRetries = 3;
  
  // Add seed for uniqueness with MAXIMUM randomness for diverse images
  // Combine multiple entropy sources: time, random, prompt hash, retry count
  const randomComponent = Math.floor(Math.random() * 1000000);
  const timeComponent = Date.now();
  const hashComponent = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  const retryOffset = retryCount * 77777; // Different seeds for retries
  const seed = (timeComponent + randomComponent + hashComponent + retryOffset) % 999999999;
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&enhance=true&model=flux&seed=${seed}`;
  
  console.log(`🎨 [PERF] Pollinations AI - URL generated (attempt ${retryCount + 1}/${maxRetries + 1})`);
  console.log('📝 Prompt:', prompt.substring(0, 100) + '...');
  console.log('🔗 Image URL:', url.substring(0, 100) + '...');
  
  // Validate the URL works before returning
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    
    if (response.status === 429) {
      // Rate limit hit - retry with exponential backoff
      if (retryCount < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 8000); // Max 8 seconds
        console.warn(`⚠️ Pollinations rate limit hit. Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return generateWithPollinations(options, retryCount + 1);
      } else {
        throw new Error('Rate limit exceeded after max retries');
      }
    }
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('✅ Pollinations URL validated successfully');
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('ℹ️ Validation timeout - image will generate on first access');
    } else if (retryCount < maxRetries && error.message?.includes('rate limit')) {
      const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 8000);
      console.warn(`⚠️ Error detected. Retrying in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return generateWithPollinations(options, retryCount + 1);
    } else {
      console.warn('⚠️ Pollinations validation failed:', error.message);
      // Return URL anyway - it might work when accessed by browser
    }
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

  // Strategy 1: Try Pollinations with retry logic (free, instant URL generation)
  try {
    console.log('🔄 [PERF] Strategy 1: Pollinations AI with retry logic');
    const imageUrl = await generateWithPollinations(options);
    const duration = ((Date.now() - startTime) / 1000).toFixed(3);
    console.log(`✅ [PERF] Pollinations URL generated in ${duration}s!`);
    return imageUrl;
  } catch (pollinationsError: any) {
    console.warn('⚠️ Pollinations failed after retries:', pollinationsError?.message || pollinationsError);
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

  // Strategy 3: Try Pollinations one more time with different seed (rate limit may have cleared)
  try {
    console.log('🔄 Final attempt: Retrying Pollinations with fresh seed...');
    const finalOptions = { ...options, prompt: options.prompt + ' ' + Date.now() };
    const imageUrl = await generateWithPollinations(finalOptions, 0);
    console.log('✅ Pollinations successful on final retry!');
    return imageUrl;
  } catch (finalError) {
    console.warn('⚠️ Final Pollinations retry failed:', finalError);
  }

  // Strategy 4: Fallback to placeholder with helpful message
  console.log('⚠️ All image generation methods exhausted, using placeholder');
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`ℹ️ Using placeholder after ${duration}s (Rate limits may apply, try again in a minute)`);
  const placeholderUrl = `https://via.placeholder.com/800x1000/6366f1/ffffff?text=${encodeURIComponent('Fashion Outfit - Retry in 1min')}`;
  return placeholderUrl;
}
