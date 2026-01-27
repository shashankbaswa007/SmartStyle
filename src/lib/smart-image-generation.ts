export async function generateImageWithRetry(
  prompt: string, 
  colors: string[],
  maxRetries: number = 3
): Promise<string> {
  console.log('🎨 Starting image generation with multiple fallbacks...');
  
  // Helper function to validate if response is actually an image
  const isValidImageResponse = async (response: Response): Promise<boolean> => {
    const contentType = response.headers.get('content-type');
    
    // Strict validation: MUST be an image content-type
    if (contentType && contentType.startsWith('image/')) {
      // Even if content-type says image, verify it's not HTML disguised
      try {
        const text = await response.clone().text();
        const firstChars = text.substring(0, 200).toLowerCase();
        // Check for ANY HTML indicators
        if (firstChars.includes('<html') || 
            firstChars.includes('<!doctype') || 
            firstChars.includes('we have moved') ||
            firstChars.includes('sign up') ||
            firstChars.includes('<body') ||
            firstChars.includes('<head')) {
          console.warn('⚠️ Image content-type but HTML content detected');
          return false;
        }
      } catch (e) {
        // If we can't read it, it's likely binary (good!)
      }
      return true;
    }
    
    // Reject if explicitly HTML
    if (contentType && (contentType.includes('html') || contentType.includes('text/'))) {
      console.warn('⚠️ HTML/text content-type detected:', contentType);
      return false;
    }
    
    // If no content-type, check the actual content
    try {
      const text = await response.clone().text();
      const firstChars = text.substring(0, 200).toLowerCase();
      if (firstChars.includes('<!doctype') || 
          firstChars.includes('<html') || 
          firstChars.includes('we have moved') ||
          firstChars.includes('sign up') ||
          firstChars.includes('pollinations.ai') ||
          firstChars.includes('<svg')) {
        console.warn('⚠️ HTML content detected in response');
        return false;
      }
    } catch (e) {
      // If we can't read it, assume it's binary (image)
      return true;
    }
    
    return true; // Assume valid if we can't determine
  };
  
  // Service 1: Try multiple Pollinations.ai URLs
  const pollinationsUrls = [
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=1000&nologo=true&private=true&seed=${Date.now()}`,
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=1000&nologo=true&seed=${Date.now() + 1000}`,
    `https://pollinations.ai/p/${encodeURIComponent(prompt.substring(0, 150))}?width=800&height=1000&seed=${Date.now()}`
  ];
  
  for (const url of pollinationsUrls) {
    try {
      console.log('🔍 Trying Pollinations.ai...');
      
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(15000)
      });
      
      if (response.ok && await isValidImageResponse(response)) {
        console.log('✅ Image generated successfully with Pollinations.ai');
        return url;
      } else {
        console.warn('⚠️ Pollinations.ai returned non-image response');
      }
    } catch (error) {
      console.warn('⚠️ Pollinations.ai attempt failed:', error);
    }
  }
  
  // Service 2: Try alternative format
  try {
    console.log('🔍 Trying alternative format...');
    const altUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.substring(0, 100))}?model=flux&width=800&height=1000&seed=${Date.now()}`;
    
    const response = await fetch(altUrl, {
      method: 'GET',
      headers: { 'Accept': 'image/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok && await isValidImageResponse(response)) {
      console.log('✅ Alternative format generated image successfully');
      return altUrl;
    }
  } catch (error) {
    console.warn('⚠️ Alternative service failed:', error);
  }
  
  // Service 3: Create a beautiful styled placeholder with gradients
  console.log('📦 Using enhanced placeholder with fashion colors');
  return createEnhancedPlaceholder(prompt, colors);
}

function createEnhancedPlaceholder(prompt: string, colors: string[]): string {
  // Extract key fashion terms from prompt for placeholder text
  const fashionTerms = prompt.match(/\b(kurta|saree|dress|outfit|shirt|pants|jacket|coat|blazer)\b/gi);
  const placeholderText = fashionTerms ? fashionTerms[0] : 'Fashion';
  
  // Use the detected colors or fallback to fashion-appropriate colors
  const color1 = colors[0]?.replace('#', '') || '8B7355'; // Warm brown
  const color2 = colors[1]?.replace('#', '') || 'D4A574'; // Beige/tan
  const color3 = colors[2]?.replace('#', '') || 'F5E6D3'; // Light cream
  
  // Ensure valid hex colors (6 characters)
  const validColor1 = color1.length === 6 ? color1 : '8B7355';
  const validColor2 = color2.length === 6 ? color2 : 'D4A574';
  
  // Create an SVG-based placeholder with gradients (more sophisticated than via.placeholder)
  const svgPlaceholder = `data:image/svg+xml,%3Csvg width='800' height='1000' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23${validColor1};stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23${validColor2};stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='1000' fill='url(%23grad)'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial, sans-serif' font-size='48' fill='white' text-anchor='middle' dominant-baseline='middle' opacity='0.9'%3E${encodeURIComponent(placeholderText)}%3C/text%3E%3C/svg%3E`;
  
  return svgPlaceholder;
}

function createStyledPlaceholder(colors: string[]): string {
  // Create a beautiful gradient placeholder instead of boring gray box
  const color1 = colors[0]?.replace('#', '') || '6366f1';
  const color2 = colors[1]?.replace('#', '') || '8b5cf6';
  
  // Ensure valid hex colors (6 characters)
  const validColor1 = color1.length === 6 ? color1 : '6366f1';
  const validColor2 = color2.length === 6 ? color2 : '8b5cf6';
  
  return `https://via.placeholder.com/800x1000/${validColor1}/${validColor2}?text=Image+Unavailable`;
}
