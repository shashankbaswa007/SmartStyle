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
  genre: z.string().describe('The preferred style genre (e.g., Formal, Casual, Streetwear).'),
  gender: z.string().describe('The gender of the person in the photo (male/female/neutral).'),
  weather: z.string().describe("The weather conditions at the person's current location."),
  skinTone: z.string().describe("The person's estimated skin tone."),
  dressColors: z.string().describe('A comma-separated list of the primary colors of the outfit.'),
  previousRecommendation: z.string().optional().describe('A previous recommendation that the user was not satisfied with. If provided, generate a different recommendation.'),
});
export type AnalyzeImageAndProvideRecommendationsInput = z.infer<typeof AnalyzeImageAndProvideRecommendationsInputSchema>;

const AnalyzeImageAndProvideRecommendationsOutputSchema = z.object({
  recommendation: z.string().describe('The detailed clothing recommendation, formatted with a list of outfits and a pro tip.'),
  imagePrompt: z.string().describe('A concise, descriptive prompt for an image generation model, describing the top recommended outfit on a mannequin or person.'),
});
export type AnalyzeImageAndProvideRecommendationsOutput = z.infer<typeof AnalyzeImageAndProvideRecommendationsOutputSchema>;

export async function analyzeImageAndProvideRecommendations(input: AnalyzeImageAndProvideRecommendationsInput): Promise<AnalyzeImageAndProvideRecommendationsOutput> {
  return analyzeImageAndProvideRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeImageAndProvideRecommendationsPrompt',
  input: {schema: AnalyzeImageAndProvideRecommendationsInputSchema},
  output: {schema: AnalyzeImageAndProvideRecommendationsOutputSchema},
  prompt: `You are a friendly, world-class fashion expert. Your task is to recommend clothing and styling choices based on user inputs.

  **User's Context:**
  - **Occasion:** {{{occasion}}}
  - **Genre Preference:** {{{genre}}}
  - **Gender:** {{{gender}}}
  - **Current Weather:** {{{weather}}}
  - **User's Skin Tone:** {{{skinTone}}}
  - **User's Current Outfit Colors:** {{{dressColors}}}
  - **User's Photo:** {{media url=photoDataUri}}

  **Your Guidelines:**
  1.  **Match Occasion & Genre:** Recommendations MUST perfectly match both the occasion and the chosen genre. A "Party" in "Formal" genre is a suit/tux, while a "Party" in "Casual" is jeans/trendy shirt.
  2.  **Weather Practicality:** Adapt all suggestions for the weather. Don't suggest a heavy coat in hot weather.
  3.  **Stylish but Realistic:** Keep suggestions stylish but practical. Avoid overly extravagant items unless the genre is high-fashion.
  4.  **Color Science:** Mention specific color combinations that complement the user’s skin tone and their original outfit colors.
  5.  **Complete the Look:** Include specific accessory and shoe recommendations that fit the vibe (e.g., sneakers for streetwear, loafers for semi-formal).
  6.  **Provide Variety:** Give 2-3 distinct alternative outfit ideas so the user has choices.
  
  {{#if previousRecommendation}}
  The user was not satisfied with this previous recommendation: "{{{previousRecommendation}}}"
  Please generate new, distinctly different recommendations. Do not repeat ideas from the previous one.
  {{/if}}

  **Output Structure:**
  Your entire response should be a single block of text formatted exactly like this:

  **Recommended Outfits:**
  1.  **[Outfit Title e.g., "Chic Casual Look"]**: [Describe top, bottom, footwear, and accessories. Explain why it fits the occasion, genre, and user's features.]
  2.  **[Outfit Title e.g., "Smart Streetwear Vibe"]**: [Describe a different complete outfit, offering variety.]
  3.  **[Outfit Title e.g., "Elegant Alternative"]**: [Optional: A third suggestion for added style or a different take.]

  💡 **Pro tip:** [Give one quick, actionable styling or color-matching tip.]

  Finally, based on your **first and best** recommendation, create a concise, descriptive prompt for an image generation model to create a photorealistic image of that recommended outfit. This prompt should describe the clothing items, colors, and style on a mannequin or anonymous person, suitable for a fashion lookbook.
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
    // The prompt now combines analysis and recommendation, so we only need the 'recommendation' and 'imagePrompt' fields.
    return output!;
  }
);
