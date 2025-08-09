// This is a server-side file.
'use server';

/**
 * @fileOverview Extracts skin tone and dress colors from an image.
 *
 * - extractColorsFromImage - Extracts skin tone and dress colors from an image.
 * - ColorExtractionInput - Input type for the color extraction function.
 * - ColorExtractionOutput - Return type for the color extraction function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ColorExtractionInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the user's outfit, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ColorExtractionInput = z.infer<typeof ColorExtractionInputSchema>;

const ColorExtractionOutputSchema = z.object({
  skinTone: z.string().describe("The user's estimated skin tone (e.g., 'fair', 'olive', 'dark')."),
  dressColors: z.string().describe('A comma-separated list of the primary colors of the outfit.'),
});
export type ColorExtractionOutput = z.infer<typeof ColorExtractionOutputSchema>;

export async function extractColorsFromImage(
  input: ColorExtractionInput
): Promise<ColorExtractionOutput> {
  return extractColorsFromImageFlow(input);
}

const extractColorsPrompt = ai.definePrompt({
  name: 'extractColorsPrompt',
  input: { schema: ColorExtractionInputSchema },
  output: { schema: ColorExtractionOutputSchema },
  prompt: `You are an expert image analyst. Analyze the provided image to determine the person's skin tone and the dominant colors of their clothing.

  Provide the skin tone as a descriptive term (e.g., 'fair', 'light', 'olive', 'tan', 'brown', 'dark').
  Provide the dress colors as a comma-separated list of the main colors you see.

  Image: {{media url=photoDataUri}}`,
});

const extractColorsFromImageFlow = ai.defineFlow(
  {
    name: 'extractColorsFromImageFlow',
    inputSchema: ColorExtractionInputSchema,
    outputSchema: ColorExtractionOutputSchema,
  },
  async (input) => {
    const { output } = await extractColorsPrompt(input);
    return output!;
  }
);
