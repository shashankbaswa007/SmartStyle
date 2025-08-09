'use server';

/**
 * @fileOverview Analyzes an image, skin tone, dress colors, occasion, gender and weather to recommend clothing.
 *
 * - analyzeImageAndProvideRecommendations - A function that handles the clothing recommendation process.
 * - AnalyzeImageAndProvideRecommendationsInput - The input type for the analyzeImageAndProvideRecommendations function.
 * - AnalyzeImageAndProvideRecommendationsOutput - The return type for the analyzeImageAndProvideRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeImageAndProvideRecommendationsInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a person, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  occasion: z.string().describe('The occasion for which the recommendation is needed.'),
  gender: z.string().describe('The gender of the person in the photo.'),
  weather: z.string().describe("The weather conditions at the person's current location."),
  skinTone: z.string().describe("The person's estimated skin tone."),
  dressColors: z.string().describe('A comma-separated list of the primary colors of the outfit.'),
});
export type AnalyzeImageAndProvideRecommendationsInput = z.infer<typeof AnalyzeImageAndProvideRecommendationsInputSchema>;

const AnalyzeImageAndProvideRecommendationsOutputSchema = z.object({
  recommendation: z.string().describe('The detailed clothing recommendation for the person, including specific suggestions for outfit items and colors for dresses and shoes.'),
  analysis: z.string().describe("The analysis of the person's current outfit, colors, and how they work with their skin tone."),
});
export type AnalyzeImageAndProvideRecommendationsOutput = z.infer<typeof AnalyzeImageAndProvideRecommendationsOutputSchema>;

export async function analyzeImageAndProvideRecommendations(input: AnalyzeImageAndProvideRecommendationsInput): Promise<AnalyzeImageAndProvideRecommendationsOutput> {
  return analyzeImageAndProvideRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeImageAndProvideRecommendationsPrompt',
  input: {schema: AnalyzeImageAndProvideRecommendationsInputSchema},
  output: {schema: AnalyzeImageAndProvideRecommendationsOutputSchema},
  prompt: `You are a world-class personal stylist. You provide clothing recommendations based on a person's skin tone, their current outfit, the occasion, gender, and local weather.

  First, provide a detailed analysis of their current outfit. Comment on the provided dress colors ({{{dressColors}}}) and how they complement or clash with the user's skin tone ({{{skinTone}}}).

  Then, provide a concrete, actionable clothing recommendation. Your recommendation must go beyond simple feedback and suggest a complete outfit.
  It must take all of the following into account:
  - Occasion: {{{occasion}}}
  - Gender: {{{gender}}}
  - Weather: {{{weather}}}
  - Skin Tone: {{{skinTone}}}
  - Original Dress Colors: {{{dressColors}}}
  - Image: {{media url=photoDataUri}}

  Based on this information, provide a detailed clothing recommendation, including which color the dress and shoes should be, and a thoughtful analysis.
  `,
});

const analyzeImageAndProvideRecommendationsFlow = ai.defineFlow(
  {
    name: 'analyzeImageAndProvideRecommendationsFlow',
    inputSchema: AnalyzeImageAndProvideRecommendationsInputSchema,
    outputSchema: AnalyzeImageAndProvideRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
