'use server';

/**
 * @fileOverview Generates an image of a fashion outfit based on a text description.
 *
 * - generateOutfitImage - A function that generates an image of an outfit.
 * - GenerateOutfitImageInput - The input type for the generateOutfitImage function.
 * - GenerateOutfitImageOutput - The return type for the generateOutfitImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateOutfitImageInputSchema = z.object({
  outfitDescription: z.string().describe('A detailed text description of the outfit to be generated.'),
});
export type GenerateOutfitImageInput = z.infer<typeof GenerateOutfitImageInputSchema>;

const GenerateOutfitImageOutputSchema = z.object({
  imageUrl: z.string().describe("The data URI of the generated image. Expected format: 'data:image/png;base64,<encoded_data>'."),
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
  async (input) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `A high-resolution, photorealistic image of a complete outfit on a mannequin, suitable for a high-end fashion lookbook. The background should be a neutral gray studio setting.
      
      Outfit details: ${input.outfitDescription}`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media.url) {
      throw new Error('Image generation failed to produce an image.');
    }

    return { imageUrl: media.url };
  }
);
