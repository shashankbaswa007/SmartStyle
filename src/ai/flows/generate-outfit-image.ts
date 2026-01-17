'use server';

/**
 * @fileOverview Generates an image of a fashion outfit based on a text description.
 * Uses multi-provider image generation with fallback strategy
 * Now includes structured analysis and optimized shopping link generation
 */

import { generateOutfitImageWithFallback } from '@/lib/image-generation';
import { analyzeGeneratedImage, analyzeGeneratedImageStructured, type StructuredAnalysis } from './analyze-generated-image';
import { searchShoppingLinksStructured, type ShoppingLinkResult } from '@/lib/tavily';

// Enhanced result type with structured shopping links
export interface EnhancedOutfitResult {
  imageUrl: string;
  dominantColors: Array<{
    name: string;
    hex: string;
    percentage: number;
  }>;
  detailedDescription: string;
  structuredAnalysis?: StructuredAnalysis;
  shoppingLinks?: ShoppingLinkResult;
  metadata: {
    generatedAt: string;
    primaryModel: string;
    analysisTime: number;
    searchTime: number;
    totalProcessingTime: number;
  };
}

/**
 * LEGACY: Generates an outfit image (simple version for backward compatibility)
 * @deprecated Use generateOutfitImageEnhanced for structured shopping links
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
    console.log('🔗 Image URL:', imageUrl.substring(0, 100) + '...');
    return imageUrl;
  } catch (error) {
    console.error('❌ All image generation methods failed:', error);
    
    // Final fallback to placeholder
    const fallbackUrl = 'https://via.placeholder.com/800x1000/6366f1/ffffff?text=Fashion+Outfit';
    console.log('⚠️ Using final fallback placeholder:', fallbackUrl);
    
    return fallbackUrl;
  }
}

/**
 * NEW: Enhanced outfit generation with structured analysis and optimized shopping links
 * Generates image, analyzes with Gemini for detailed item data, and searches optimized shopping links
 * 
 * @param imagePrompt - The detailed prompt for the outfit image
 * @param colorHexCodes - Array of color hex codes to include
 * @param outfitTitle - Title of the outfit (e.g., "Sunset Boulevard Chic")
 * @param outfitDescription - Description of the outfit style
 * @param outfitItems - Array of item types (e.g., ["shirt", "pants"])
 * @param gender - Gender for the outfit ("male" | "female" | "unisex")
 * @returns Enhanced result with image, analysis, and structured shopping links
 */
export async function generateOutfitImageEnhanced(
  imagePrompt: string,
  colorHexCodes: string[],
  outfitTitle: string,
  outfitDescription: string,
  outfitItems: string[],
  gender: string
): Promise<EnhancedOutfitResult> {
  const startTime = Date.now();
  console.log('🎨 [ENHANCED] Starting outfit generation with structured shopping...');
  console.log('📝 Title:', outfitTitle);
  console.log('👔 Items:', outfitItems.join(', '));
  console.log('👤 Gender:', gender);

  try {
    // Step 1: Generate the outfit image
    const imageUrl = await generateOutfitImageWithFallback(imagePrompt, colorHexCodes);
    console.log('✅ Image generated:', imageUrl.substring(0, 80) + '...');

    // Step 2: Analyze the generated image for colors and basic data
    const analysisStartTime = Date.now();
    const basicAnalysis = await analyzeGeneratedImage(
      imageUrl,
      outfitTitle,
      outfitDescription,
      outfitItems,
      gender
    );
    const analysisTime = Date.now() - analysisStartTime;
    console.log(`✅ Basic analysis complete: ${analysisTime}ms`);

    // Step 3: Attempt structured analysis for shopping optimization
    let structuredAnalysis: StructuredAnalysis | undefined;
    let shoppingLinks: ShoppingLinkResult | undefined;
    let searchTime = 0;
    let primaryModel = 'local-fallback';

    if (basicAnalysis.structuredItems) {
      structuredAnalysis = basicAnalysis.structuredItems;
      primaryModel = 'gemini-2.0-flash-exp';
      console.log(`✅ Structured analysis available: ${structuredAnalysis.items.length} items detected`);

      // Step 4: Search optimized shopping links
      try {
        const searchStartTime = Date.now();
        shoppingLinks = await searchShoppingLinksStructured(structuredAnalysis);
        searchTime = Date.now() - searchStartTime;
        console.log(`✅ Shopping search complete: ${searchTime}ms, ${shoppingLinks.metadata.totalLinksFound} links found`);
      } catch (searchError) {
        console.error('⚠️ Shopping search failed, will use fallback links:', (searchError as Error).message);
        shoppingLinks = undefined;
      }
    } else {
      console.log('⚠️ Structured analysis not available, shopping links will use fallback');
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ [ENHANCED] Complete: ${totalTime}ms total (${analysisTime}ms analysis, ${searchTime}ms search)`);

    return {
      imageUrl,
      dominantColors: basicAnalysis.dominantColors,
      detailedDescription: basicAnalysis.detailedDescription,
      structuredAnalysis,
      shoppingLinks,
      metadata: {
        generatedAt: new Date().toISOString(),
        primaryModel,
        analysisTime,
        searchTime,
        totalProcessingTime: totalTime,
      },
    };

  } catch (error) {
    console.error('❌ Enhanced outfit generation failed:', error);
    
    // Fallback result with placeholder
    const fallbackUrl = 'https://via.placeholder.com/800x1000/6366f1/ffffff?text=Fashion+Outfit';
    
    return {
      imageUrl: fallbackUrl,
      dominantColors: [],
      detailedDescription: outfitDescription,
      metadata: {
        generatedAt: new Date().toISOString(),
        primaryModel: 'error',
        analysisTime: 0,
        searchTime: 0,
        totalProcessingTime: Date.now() - startTime,
      },
    };
  }
}
