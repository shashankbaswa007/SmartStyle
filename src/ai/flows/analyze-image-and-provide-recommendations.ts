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
  weather: z.string().describe('The weather conditions at the person\'s current location.'),
  skinTone: z.string().describe('The skin tone of the person in the photo.'),
  dressColors: z.string().describe('The colors of the dress worn by the person in the photo.'),
});
export type AnalyzeImageAndProvideRecommendationsInput = z.infer<typeof AnalyzeImageAndProvideRecommendationsInputSchema>;

const AnalyzeImageAndProvideRecommendationsOutputSchema = z.object({
  recommendation: z.string().describe('The clothing recommendation for the person.'),
  analysis: z.string().describe('The analysis of the person\'s current outfit and colors.'),
});
export type AnalyzeImageAndProvideRecommendationsOutput = z.infer<typeof AnalyzeImageAndProvideRecommendationsOutputSchema>;

export async function analyzeImageAndProvideRecommendations(input: AnalyzeImageAndProvideRecommendationsInput): Promise<AnalyzeImageAndProvideRecommendationsOutput> {
  return analyzeImageAndProvideRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeImageAndProvideRecommendationsPrompt',
  input: {schema: AnalyzeImageAndProvideRecommendationsInputSchema},
  output: {schema: AnalyzeImageAndProvideRecommendationsOutputSchema},
  prompt: `You are a personal stylist who gives clothing recommendations based on the person's skin tone, the colors in the image, the occasion, gender, and the weather at their current location.

  Analyze the image, skin tone, dress colors, occasion, gender, and weather information to provide a clothing recommendation. Provide feedback on the person's current outfit and colors, and suggest improvements if necessary.

  Here is the information you will use:

  Occasion: {{{occasion}}}
  Gender: {{{gender}}}
  Weather: {{{weather}}}
  Skin Tone: {{{skinTone}}}
  Dress Colors: {{{dressColors}}}
  Image: {{media url=photoDataUri}}

  Based on this information, provide a detailed clothing recommendation and analysis.
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
