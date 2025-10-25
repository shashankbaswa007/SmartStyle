'use server';

/**
 * @fileOverview Analyzes user style preferences (NO IMAGE) to recommend outfits.
 * Privacy-first approach - uses only text inputs.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getPersonalizationContext } from '@/lib/personalization';

const AnalyzeStylePreferencesInputSchema = z.object({
  occasion: z.string().describe('The occasion for which recommendations are needed'),
  genre: z.string().describe('The preferred style genre (e.g., minimalist, bohemian, professional)'),
  gender: z.string().describe('Gender (Male/Female/Neutral)'),
  skinTone: z.string().describe('Skin tone (fair/light/medium/olive/tan/brown/dark)'),
  colorPreferences: z.string().optional().describe('User color preferences (optional)'),
  additionalNotes: z.string().optional().describe('Any additional requirements or preferences'),
  userId: z.string().optional().describe('User ID for personalization'),
});
export type AnalyzeStylePreferencesInput = z.infer<typeof AnalyzeStylePreferencesInputSchema>;

const AnalyzeStylePreferencesOutputSchema = z.object({
  styleAnalysis: z.string().describe('Analysis of the user preferences and skin tone color matching'),
  outfitRecommendations: z.array(z.object({
    title: z.string().describe('Catchy outfit title'),
    description: z.string().describe('Detailed description of the outfit'),
    colorPalette: z.array(z.string()).describe('3-4 hex color codes for the outfit'),
    items: z.array(z.string()).describe('List of clothing items'),
    shoppingLinks: z.object({
      amazon: z.string().nullable(),
      flipkart: z.string().nullable(),
      myntra: z.string().nullable(),
    }).optional(),
  })).describe('List of 3 outfit recommendations'),
  colorPaletteRecommendation: z.string().optional().describe('Color palette that flatters the skin tone'),
  tips: z.array(z.string()).optional().describe('3-5 styling tips'),
});
export type AnalyzeStylePreferencesOutput = z.infer<typeof AnalyzeStylePreferencesOutputSchema>;

export async function analyzeStylePreferences(input: AnalyzeStylePreferencesInput): Promise<AnalyzeStylePreferencesOutput> {
  // Get personalization data if userId provided
  let personalizationContext = "";
  if (input.userId) {
    try {
      const contextData = await getPersonalizationContext(input.userId);
      // Convert to string for prompt
      personalizationContext = JSON.stringify(contextData, null, 2);
    } catch (error) {
      console.error("Error fetching personalization:", error);
    }
  }

  const promptText = `You are an expert fashion stylist and personal shopper. Based on the user's preferences (NO PHOTO), provide personalized outfit recommendations.

**USER PREFERENCES:**
- **Occasion:** ${input.occasion}
- **Style Genre:** ${input.genre}
- **Gender:** ${input.gender}
- **Skin Tone:** ${input.skinTone}
- **Color Preferences:** ${input.colorPreferences || 'No specific preference'}
- **Additional Notes:** ${input.additionalNotes || 'None'}

${personalizationContext ? `**PERSONALIZATION DATA (IMPORTANT - Use this to tailor recommendations):**
${personalizationContext}

**PRIORITY INSTRUCTIONS:**
- If the user has selected outfits before, ensure AT LEAST 2 OUT OF 3 recommendations heavily feature their preferred colors and styles
- The third recommendation can introduce variety but should still align with their overall aesthetic
- Completely AVOID any colors or styles they've disliked` : ''}

**YOUR TASK:**
1. Provide a brief style analysis considering their preferences and skin tone
2. Recommend 3 complete outfits that are:
   - Appropriate for the occasion
   - Match their style genre
   - Complement their skin tone
   - Incorporate their color preferences
   ${personalizationContext ? '- Aligned with their learned preferences (prioritize selected outfits)' : ''}
3. For each outfit, provide:
   - A catchy title
   - Detailed description
   - List of specific items (e.g., "Navy blazer", "White Oxford shirt")
   - Color palette (hex codes like "#0000FF")
4. Suggest a color palette that flatters their skin tone
5. Include 3-5 styling tips

Be creative, specific, and trendy!`;

  const result = await ai.generate({
    prompt: promptText,
    output: { schema: AnalyzeStylePreferencesOutputSchema },
  });

  return result.output!;
}
