'use server';

/**
 * @fileOverview Generates an image of a fashion outfit based on a text description.
 * Uses multi-provider image generation with fallback strategy
 */

import { generateOutfitImageWithFallback } from '@/lib/image-generation';

/**
 * Generates an outfit image based on the provided prompt and color palette
 * Uses multiple image generation providers with automatic fallback
 * 
 * @param imagePrompt - The detailed prompt for the outfit image
 * @param colorHexCodes - Array of color hex codes to include in the outfit
 * @returns URL of the generated image (URL or data URI)
 */
export async function generateOutfitImage(
  imagePrompt: string,
  colorHexCodes: string[]
): Promise<string> {
  console.log('🎨 Image generation requested');
  console.log('📝 Prompt:', imagePrompt.substring(0, 100) + '...');
  console.log('🎨 Colors:', colorHexCodes);

  try {
    const imageUrl = await generateOutfitImageWithFallback(imagePrompt, colorHexCodes);
    console.log('✅ Image generated successfully');
    console.log('� Image URL:', imageUrl.substring(0, 100) + '...');
    return imageUrl;
  } catch (error) {
    console.error('❌ All image generation methods failed:', error);
    
    // Final fallback to placeholder
    const fallbackUrl = 'https://via.placeholder.com/800x1000/6366f1/ffffff?text=Fashion+Outfit';
    console.log('⚠️ Using final fallback placeholder:', fallbackUrl);
    
    return fallbackUrl;
  }
}
