/**
 * Pollinations.ai image generation client
 * NOTE: Currently disabled as the API is not generating images reliably
 */

export interface PollinationsImageOptions {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  nologo?: boolean;
  private?: boolean;
  enhance?: boolean;
}

/**
 * Generate an image using Pollinations.ai
 * @deprecated Currently not working - returns placeholder instead
 */
export async function generatePollinationsImage(
  options: PollinationsImageOptions
): Promise<string> {
  
  // Return a placeholder image instead
  const placeholderUrl = `https://via.placeholder.com/${options.width || 800}x${options.height || 1000}/6366f1/ffffff?text=Fashion+Outfit`;
  
  
  return placeholderUrl;
}

/**
 * Build the Pollinations.ai image URL
 * @deprecated Currently not in use
 */
export function buildPollinationsUrl(options: PollinationsImageOptions): string {
  const baseUrl = 'https://image.pollinations.ai/prompt';
  const encodedPrompt = encodeURIComponent(options.prompt);
  
  const params = new URLSearchParams();
  if (options.width) params.append('width', options.width.toString());
  if (options.height) params.append('height', options.height.toString());
  if (options.seed) params.append('seed', options.seed.toString());
  if (options.model) params.append('model', options.model);
  if (options.nologo) params.append('nologo', 'true');
  if (options.private) params.append('private', 'true');
  if (options.enhance) params.append('enhance', 'true');
  
  const queryString = params.toString();
  const url = queryString 
    ? `${baseUrl}/${encodedPrompt}?${queryString}`
    : `${baseUrl}/${encodedPrompt}`;
  
  return url;
}

/**
 * Check if Pollinations.ai is available (always true - no key needed!)
 */
export function isPollinationsAvailable(): boolean {
  return true; // Always available, no API key required!
}
