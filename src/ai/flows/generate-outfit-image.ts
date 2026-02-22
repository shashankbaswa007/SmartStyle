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

  try {
    const imageUrl = await generateOutfitImageWithFallback(imagePrompt, colorHexCodes);
    if (!imageUrl) {
      return 'https://via.placeholder.com/800x1000/6366f1/ffffff?text=Fashion+Outfit';
    }
    return imageUrl;
  } catch (error) {
    
    // Final fallback to placeholder
    const fallbackUrl = 'https://via.placeholder.com/800x1000/6366f1/ffffff?text=Fashion+Outfit';
    
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

  try {
    // Step 1: Generate the outfit image
    const imageUrl = await generateOutfitImageWithFallback(imagePrompt, colorHexCodes);
    if (!imageUrl) {
      const fallbackUrl = 'https://via.placeholder.com/800x1000/6366f1/ffffff?text=Fashion+Outfit';
      return {
        imageUrl: fallbackUrl,
        dominantColors: [],
        detailedDescription: outfitDescription,
        metadata: {
          generatedAt: new Date().toISOString(),
          primaryModel: 'null-fallback',
          analysisTime: 0,
          searchTime: 0,
          totalProcessingTime: Date.now() - startTime,
        },
      };
    }

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

    // Step 3: Attempt structured analysis for shopping optimization
    let structuredAnalysis: StructuredAnalysis | undefined;
    let shoppingLinks: ShoppingLinkResult | undefined;
    let searchTime = 0;
    let primaryModel = 'local-fallback';

    if (basicAnalysis.structuredItems) {
      structuredAnalysis = basicAnalysis.structuredItems;
      primaryModel = 'gemini-2.0-flash-exp';

      // Step 4: Search optimized shopping links
      try {
        const searchStartTime = Date.now();
        shoppingLinks = await searchShoppingLinksStructured(structuredAnalysis);
        searchTime = Date.now() - searchStartTime;
      } catch (searchError) {
        shoppingLinks = undefined;
      }
    } else {
    }

    const totalTime = Date.now() - startTime;

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
