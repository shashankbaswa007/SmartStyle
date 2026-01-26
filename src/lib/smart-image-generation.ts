export async function generateImageWithRetry(
  prompt: string, 
  colors: string[],
  maxRetries: number = 2
): Promise<string> {
  const baseUrl = 'https://image.pollinations.ai/prompt/';
  
  // Add cache-busting and optimization parameters
  const enhancedPrompt = `${prompt}, high quality, detailed, professional photography`;
  const params = new URLSearchParams({
    width: '800',
    height: '1000',
    model: 'flux', // Faster model
    seed: Math.random().toString().substring(2, 10), // Random seed
    nologo: 'true',
    enhance: 'true',
  });
  
  const url = `${baseUrl}${encodeURIComponent(enhancedPrompt)}?${params}`;
  
  // Try to preload image to verify it works
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎨 Image generation attempt ${attempt}/${maxRetries}`);
      
      // Quick HEAD request to verify image is accessible
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`✅ Image generated successfully on attempt ${attempt}`);
        return url;
      }
      
      console.warn(`⚠️ Attempt ${attempt} returned status ${response.status}`);
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        // Return a styled placeholder on final failure
        console.log('📦 Using styled placeholder instead');
        return createStyledPlaceholder(colors);
      }
      
      // Wait before retry
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return createStyledPlaceholder(colors);
}

function createStyledPlaceholder(colors: string[]): string {
  // Create a beautiful gradient placeholder instead of boring gray box
  const color1 = colors[0]?.replace('#', '') || '6366f1';
  const color2 = colors[1]?.replace('#', '') || '8b5cf6';
  
  return `https://via.placeholder.com/800x1000/${color1}/${color2}?text=Image+Unavailable`;
}
