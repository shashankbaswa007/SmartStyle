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
  previousRecommendation: z.string().optional().describe('A previous recommendation that the user was not satisfied with. If provided, generate a different recommendation.'),
});
export type AnalyzeImageAndProvideRecommendationsInput = z.infer<typeof AnalyzeImageAndProvideRecommendationsInputSchema>;

const AnalyzeImageAndProvideRecommendationsOutputSchema = z.object({
  recommendation: z.string().describe('The detailed clothing recommendation for the person, including specific suggestions for outfit items and colors for dresses and shoes.'),
  analysis: z.string().describe("The analysis of the person's current outfit, colors, and how they work with their skin tone."),
  imagePrompt: z.string().describe('A concise, descriptive prompt for an image generation model, describing the recommended outfit on a mannequin or person.'),
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

  {{#if previousRecommendation}}
  The user was not satisfied with this previous recommendation: "{{{previousRecommendation}}}"
  Please generate a new, distinctly different recommendation. Do not repeat ideas from the previous one.
  {{/if}}

  Based on this information, provide a detailed clothing recommendation, including which color the dress and shoes should be, and a thoughtful analysis.
  
  Finally, create a concise, descriptive prompt for an image generation model to create a photorealistic image of the recommended outfit. This prompt should describe the clothing items, colors, and style on a mannequin or anonymous person, suitable for a fashion lookbook.
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
