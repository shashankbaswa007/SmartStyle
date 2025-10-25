'use server';

/**
 * @fileOverview Generates an image of a fashion outfit based on a text description.
 *
 * - generateOutfitImage - A function that generates an image of an outfit.
 * - GenerateOutfitImageInput - The input type for the generateOutfitImage function.
 * - GenerateOutfitImageOutput - The return type for the generateOutfitImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { generateImageWithPollinations } from '@/lib/pollinations-client';
import { multiGeminiManager } from '@/lib/multi-gemini-client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GenerateOutfitImageInputSchema = z.object({
  outfitDescriptions: z.array(z.string()).describe('Array of detailed text descriptions of outfits to be generated.'),
});
export type GenerateOutfitImageInput = z.infer<typeof GenerateOutfitImageInputSchema>;

const GenerateOutfitImageOutputSchema = z.object({
  imageUrls: z.array(z.string()).describe("Array of image URLs or data URIs. Can be from Gemini AI, Pollinations.ai, or placeholders."),
  sources: z.array(z.enum(['gemini', 'pollinations', 'placeholder'])).optional().describe("Source of each image"),
});
export type GenerateOutfitImageOutput = z.infer<typeof GenerateOutfitImageOutputSchema>;

export async function generateOutfitImage(input: GenerateOutfitImageInput): Promise<GenerateOutfitImageOutput> {
  return generateOutfitImageFlow(input);
}

const generateOutfitImageFlow = ai.defineFlow(
  {
    name: 'generateOutfitImageFlow',
    inputSchema: GenerateOutfitImageInputSchema,
    outputSchema: GenerateOutfitImageOutputSchema,
  },
  async (input: GenerateOutfitImageInput) => {
    // Using Gemini 2.0 Flash - attempting image generation
    // NOTE: This likely won't work as Gemini models cannot generate images,
    // but will automatically fall back to Pollinations.ai
    const model = 'gemini-2.0-flash';

    const imageUrls: string[] = [];
    const sources: ('gemini' | 'pollinations' | 'placeholder')[] = [];

    console.log(`🎨 Generating ${input.outfitDescriptions.length} outfit images...`);
    console.log(`🔑 Available Gemini quota: ${multiGeminiManager.getTotalAvailableQuota()} requests`);

    for (const description of input.outfitDescriptions) {
      const promptText = `Generate a professional fashion photograph with the following specifications:

Subject: ${description}

Style Requirements:
- Professional studio fashion photography
- Full body shot, well-composed and centered
- Clean, neutral background (white or light gray studio)
- Soft, flattering lighting from multiple angles
- High resolution and sharp focus
- Fashion magazine editorial quality
- Model posed naturally and confidently

Technical Specs:
- Portrait orientation (3:4 aspect ratio ideal)
- Professional color grading
- Photorealistic rendering
- 8K quality details`;

      let generatedImage = false;

      // STRATEGY 1: Try Gemini 2.5 Flash image generation with multi-key support
      if (multiGeminiManager.hasAvailableKeys()) {
        const maxGeminiAttempts = 3;
        let geminiAttempt = 0;

        while (geminiAttempt < maxGeminiAttempts && !generatedImage) {
          const apiKey = multiGeminiManager.getNextAvailableKey();
          
          if (!apiKey) {
            console.log('⚠️ No Gemini keys available, skipping to Pollinations.ai');
            break;
          }

          try {
            const keyInfo = multiGeminiManager.getCurrentKeyInfo();
            console.log(`🔄 Trying ${model} with ${keyInfo?.name}...`);

            // Create Gemini client with current key from multi-key manager
            const genAI = new GoogleGenerativeAI(apiKey);
            const geminiModel = genAI.getGenerativeModel({ 
              model: model
            });

            // Generate content - try to get image output
            const result = await geminiModel.generateContent({
              contents: [{
                role: 'user',
                parts: [{
                  text: promptText,
                }],
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
                // Note: Gemini doesn't support image output, but we'll try
                // It will likely return an error or text description instead
              },
            });

            const response = result.response;
            
            // Check if response has inline image data
            if (response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                if (part.inlineData?.data) {
                  const imageData = part.inlineData;
                  const base64Image = imageData.data;
                  const mimeType = imageData.mimeType || 'image/jpeg';
                  
                  const imageUrl = `data:${mimeType};base64,${base64Image}`;
                  imageUrls.push(imageUrl);
                  sources.push('gemini');
                  generatedImage = true;
                  multiGeminiManager.incrementCurrentUsage();
                  console.log(`✅ Generated image with ${model} using ${keyInfo?.name}`);
                  break;
                }
              }
            }

            if (!generatedImage) {
              // Check for text content that might indicate an issue
              const textContent = response.text?.();
              if (textContent) {
                console.log(`ℹ️ Gemini response (text): ${textContent.substring(0, 100)}...`);
              }
              console.warn(`⚠️ ${model} returned no image data, attempt ${geminiAttempt + 1}/${maxGeminiAttempts}`);
              geminiAttempt++;
            }
          } catch (err: any) {
            // Check if it's a quota error
            const isQuotaError = err.status === 429 || 
                                err.message?.includes('quota') || 
                                err.message?.includes('RESOURCE_EXHAUSTED') ||
                                err.message?.includes('Too Many Requests') ||
                                err.message?.includes('429');
            
            if (isQuotaError) {
              console.log(`⚠️ ${multiGeminiManager.getCurrentKeyInfo()?.name} quota exceeded for images`);
              
              // Try to switch to next Gemini key
              const switched = multiGeminiManager.markCurrentKeyExhausted();
              
              if (switched) {
                console.log(`🔄 Retrying with ${multiGeminiManager.getCurrentKeyInfo()?.name}...`);
                // Reset attempts for new key
                geminiAttempt = 0;
                continue;
              } else {
                console.log('💡 All Gemini keys exhausted, will try Pollinations.ai fallback');
                break;
              }
            }
            
            // Check if model is not available
            if (err.message?.includes('not found') || err.message?.includes('404') || err.status === 404) {
              console.log(`⚠️ ${model} not available, falling back to Pollinations.ai`);
              break;
            }

            // Check if method not supported (model doesn't support image generation)
            if (err.message?.includes('not supported') || err.message?.includes('UNSUPPORTED_METHOD')) {
              console.log(`⚠️ ${model} doesn't support image generation`);
              console.log(`📝 Error details: ${err.message}`);
              break;
            }
            
            console.warn(`Image generation attempt ${geminiAttempt + 1}/${maxGeminiAttempts} failed: ${err.message}`);
            geminiAttempt++;
            
            // Exponential backoff for retryable errors
            if (geminiAttempt < maxGeminiAttempts) {
              const delay = Math.min(1000 * Math.pow(2, geminiAttempt), 5000);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
      } else {
        console.log('⚠️ No Gemini keys available, using Pollinations.ai directly');
      }

      // STRATEGY 2: Try Pollinations.ai as fallback (FREE AI generation, no key needed!)
      if (!generatedImage) {
        try {
          console.log('🤖 Attempting Pollinations.ai AI generation (no API key required)...');
          const pollinationsResult = await generateImageWithPollinations(description);
          
          if (pollinationsResult) {
            imageUrls.push(pollinationsResult.url);
            sources.push('pollinations');
            generatedImage = true;
            console.log('✅ Generated AI image with Pollinations.ai');
          }
        } catch (pollinationsError) {
          console.error('❌ Pollinations.ai error:', pollinationsError);
        }
      }

      // STRATEGY 3: Use placeholder as last resort
      if (!generatedImage) {
        console.warn(`Failed to generate image for description: ${description}. Using placeholder.`);
        // Add a placeholder to maintain array consistency
        imageUrls.push('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5PdXRmaXQgSW1hZ2UgVW5hdmFpbGFibGU8L3RleHQ+PC9zdmc+');
        sources.push('placeholder');
      }
    }

    console.log(`📊 Image generation summary: Gemini: ${sources.filter(s => s === 'gemini').length}, Pollinations: ${sources.filter(s => s === 'pollinations').length}, Placeholders: ${sources.filter(s => s === 'placeholder').length}`);
    console.log(`🔑 Keys status:\n${multiGeminiManager.getKeysSummary()}`);

    // Return images with metadata
    return { 
      imageUrls,
      sources,
    };
  }
);
