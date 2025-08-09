// This is a server-side file.
'use server';

/**
 * @fileOverview Analyzes the user's current outfit from an image and provides style feedback.
 *
 * - analyzeCurrentOutfitAndProvideFeedback - Analyzes and provides feedback on an outfit.
 * - OutfitAnalysisInput - Input type for the outfit analysis function.
 * - OutfitAnalysisOutput - Return type for the outfit analysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OutfitAnalysisInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the user's outfit, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  occasion: z.string().describe('The occasion for which the outfit is intended.'),
  gender: z.string().describe('The gender of the person in the outfit.'),
  weatherInfo: z.string().describe('The current weather conditions at the user\'s location. This could be a string like "The weather in London is 25°C with clear skies."'),
});
export type OutfitAnalysisInput = z.infer<typeof OutfitAnalysisInputSchema>;

const OutfitAnalysisOutputSchema = z.object({
  feedback: z.string().describe('Feedback on the user\'s current outfit, including color combination analysis and suggestions for improvement.'),
  recommendations: z.string().describe('Outfit recommendations based on the analysis, occasion, gender, and weather.'),
});
export type OutfitAnalysisOutput = z.infer<typeof OutfitAnalysisOutputSchema>;

export async function analyzeCurrentOutfitAndProvideFeedback(
  input: OutfitAnalysisInput
): Promise<OutfitAnalysisOutput> {
  return analyzeCurrentOutfitAndProvideFeedbackFlow(input);
}

const analyzeOutfitPrompt = ai.definePrompt({
  name: 'analyzeOutfitPrompt',
  input: {schema: OutfitAnalysisInputSchema},
  output: {schema: OutfitAnalysisOutputSchema},
  prompt: `You are a world-class fashion stylist. Analyze the user's outfit in the provided image. Be highly accurate in identifying clothing items, colors, and style.

  Your analysis must consider the following context:
  - Occasion: {{{occasion}}}
  - Gender: {{{gender}}}
  - Weather: {{{weatherInfo}}}

  Provide constructive, specific, and actionable feedback on the current outfit. Comment on color combinations, fit, and appropriateness for the occasion and weather.

  Then, provide 2-3 concrete recommendations for alternative outfits or improvements. Recommendations should be specific (e.g., "swap the black shoes for brown loafers," not just "wear different shoes").

  Ensure your response is helpful, encouraging, and provides clear style advice.`,
});

const analyzeCurrentOutfitAndProvideFeedbackFlow = ai.defineFlow(
  {
    name: 'analyzeCurrentOutfitAndProvideFeedbackFlow',
    inputSchema: OutfitAnalysisInputSchema,
    outputSchema: OutfitAnalysisOutputSchema,
  },
  async input => {
    const {output} = await analyzeOutfitPrompt(input);
    return output!;
  }
);
