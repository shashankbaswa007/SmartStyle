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
  weatherInfo: z.string().describe('The current weather conditions at the user\'s location.'),
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
  prompt: `Analyze the user's outfit in the provided image, considering the occasion, gender, and current weather conditions. Provide feedback on the color combinations and suggest improvements if needed.

  Image: {{media url=photoDataUri}}
  Occasion: {{{occasion}}}
  Gender: {{{gender}}}
  Weather: {{{weatherInfo}}}

  Respond with feedback on the outfit and recommendations for alternative clothing options, if any, in a clear and concise manner.
  Make sure the colors that are analysed in the image are accurate. To get accurate results get the skin tone, dress colors , occasion , gender and weather info and give it to Gemini API by creating a chat and giving this information to it to get the proper result.Return the result to the user in a appropriate, clean manner.
  Feedback:
  Recommendations:`,
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
