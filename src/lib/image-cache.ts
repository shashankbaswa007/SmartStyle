/**
 * Image Caching Utility
 * 
 * Caches generated images in Firebase Storage to avoid regenerating
 * the same images repeatedly. Uses MD5 hash of prompt as cache key.
 * 
 * Expected savings: 60-70% reduction in image generation calls
 * Cost: ~$0.05/month for Firebase Storage
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import crypto from 'crypto';

/**
 * Generate a cache key from image generation prompt
 */
function generateCacheKey(prompt: string, colors: string[]): string {
  const normalizedPrompt = prompt.toLowerCase().trim();
  const sortedColors = colors.sort().join(',');
  const cacheInput = `${normalizedPrompt}|${sortedColors}`;
  return crypto.createHash('md5').update(cacheInput).digest('hex');
}

/**
 * Check if image exists in cache
 * Returns cached image URL if found, null otherwise
 */
export async function getCachedImage(
  prompt: string, 
  colors: string[]
): Promise<string | null> {
  // Server-side: Firebase Storage client SDK lacks auth context — skip
  if (typeof window === 'undefined') return null;

  try {
    const hash = generateCacheKey(prompt, colors);
    const imageRef = ref(storage, `generated-images/${hash}.jpg`);
    
    const url = await getDownloadURL(imageRef);
    console.log(`✅ [IMAGE CACHE HIT] Found cached image for prompt hash: ${hash}`);
    return url;
  } catch (error) {
    // Image not in cache or error accessing storage
    return null;
  }
}

/**
 * Cache a generated image to Firebase Storage
 * Downloads image from URL and uploads to Storage
 */
export async function cacheImage(
  prompt: string, 
  colors: string[],
  imageUrl: string
): Promise<string> {
  // Server-side: Firebase Storage client SDK lacks auth context — skip
  if (typeof window === 'undefined') return imageUrl;

  try {
    const hash = generateCacheKey(prompt, colors);
    const imageRef = ref(storage, `generated-images/${hash}.jpg`);
    
    // Fetch image from generation service
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Upload to Firebase Storage
    await uploadBytes(imageRef, blob, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000', // Cache for 1 year
    });
    
    // Get the permanent download URL
    const cachedUrl = await getDownloadURL(imageRef);
    console.log(`✅ [IMAGE CACHED] Stored image with hash: ${hash}`);
    
    return cachedUrl;
  } catch (error) {
    console.error('❌ [IMAGE CACHE ERROR] Failed to cache image:', error);
    // Return original URL if caching fails
    return imageUrl;
  }
}

/**
 * Get cache statistics (for monitoring)
 */
export async function getCacheStats(): Promise<{
  totalCachedImages: number;
  totalSizeBytes: number;
}> {
  try {
    const { listAll, getMetadata } = await import('firebase/storage');
    const imagesRef = ref(storage, 'generated-images');
    const result = await listAll(imagesRef);
    
    let totalSize = 0;
    for (const item of result.items) {
      const metadata = await getMetadata(item);
      totalSize += metadata.size;
    }
    
    return {
      totalCachedImages: result.items.length,
      totalSizeBytes: totalSize,
    };
  } catch (error) {
    console.error('❌ [CACHE STATS ERROR]:', error);
    return {
      totalCachedImages: 0,
      totalSizeBytes: 0,
    };
  }
}
