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
  previousRecommendation: z.string().optional().describe('A JSON string of a previous recommendation that the user was not satisfied with. If provided, generate a different recommendation.'),
});
export type AnalyzeImageAndProvideRecommendationsInput = z.infer<typeof AnalyzeImageAndProvideRecommendationsInputSchema>;

const AnalyzeImageAndProvideRecommendationsOutputSchema = z.object({
  feedback: z.string().describe("A paragraph of general feedback on the user's current outfit."),
  highlights: z.array(z.string()).describe('A list of 2-3 key positive highlights or actionable style tips in short sentences.'),
  colorSuggestions: z.array(z.object({
    name: z.string().describe('The name of the color (e.g., "Dusty Rose").'),
    hex: z.string().describe('The hex code for the color (e.g., "#D8A0A7").'),
    reason: z.string().describe('A short sentence on why this color is recommended.'),
  })).describe('An array of 3-4 recommended colors with their hex codes and reasons.'),
  outfitRecommendations: z.array(z.object({
    title: z.string().describe('A catchy title for the outfit (e.g., "Chic Casual Look").'),
    items: z.array(z.string()).describe('A list of 2-4 clothing items for this outfit (e.g., "White Linen Shirt", "Beige Chino Shorts", "Brown Leather Loafers").'),
  })).describe('A list of 2-3 complete outfit recommendations.'),
  notes: z.string().describe('A concluding pro tip or a gentle style note in a single sentence.'),
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
  prompt: `You are a friendly, world-class fashion expert. Your task is to analyze a user's current outfit and then recommend alternative clothing and styling choices in a structured format.

  **User's Context:**
  - **Occasion:** {{{occasion}}}
  - **Genre Preference:** {{{genre}}}
  - **Gender:** {{{gender}}}
  - **Current Weather:** {{{weather}}}
  - **User's Skin Tone:** {{{skinTone}}}
  - **User's Current Outfit Colors:** {{{dressColors}}}
  - **User's Photo:** {{media url=photoDataUri}}

  **Your Guidelines:**

  **1. Outfit Analysis First:**
  - Evaluate the uploaded outfit in the photo and determine if it is:
    - **Perfect:** Appreciate the user’s choice and suggest additional ideas for variety.
    - **Good but could be better:** Point out small improvements.
    - **Not suitable:** Gently explain why and recommend better alternatives.
  - Your analysis should form the basis of the "feedback" field. Always keep the tone positive and encouraging.

  **2. Recommendation Rules:**
  - Recommendations MUST perfectly match the occasion and genre.
  - Adapt all suggestions for the weather.
  - Keep suggestions stylish but practical.
  - Mention specific color combinations that complement the user’s skin tone.
  - Provide 2-3 distinct alternative outfit ideas.
  
  {{#if previousRecommendation}}
  The user was not satisfied with this previous recommendation: "{{{previousRecommendation}}}"
  Please generate new, distinctly different recommendations. Do not repeat ideas from the previous one.
  {{/if}}

  **Output Structure:**
  Your entire response MUST be a valid JSON object matching the output schema. Populate each field according to these instructions:
  - **feedback**: Your overall analysis of the user's current outfit.
  - **highlights**: 2-3 short, bullet-point-style highlights or key takeaways.
  - **colorSuggestions**: Suggest 3-4 complementary colors. Provide a name, a valid hex code, and a brief reason.
  - **outfitRecommendations**: Create 2-3 distinct outfit suggestions, each with a title and a list of specific clothing items.
  - **notes**: A final, single-sentence "pro tip".
  - **imagePrompt**: Based on your **first and best** outfit recommendation, create a concise prompt for an image generation model to create a photorealistic image of that outfit on a mannequin.
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
