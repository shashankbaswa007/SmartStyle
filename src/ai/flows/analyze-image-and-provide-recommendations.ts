'use server';

/**
 * @fileOverview Analyzes an image, skin tone, dress colors, occasion, gender and weather to recommend clothing.
 *
 * - analyzeImageAndProvideRecommendations - A function that handles the clothing recommendation process.
 * - AnalyzeImageAndProvideRecommendationsInput - The input type for the analyzeImageAndProvideRecommendations function.
 * - AnalyzeImageAndProvideRecommendationsOutput - The return type for the analyzeImageAndProvideRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { getPersonalizationContext } from '@/lib/personalization';
import { generateRecommendationsWithGroq, isGroqConfigured } from '@/lib/groq-client';

const AnalyzeImageAndProvideRecommendationsInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "PRIVACY NOTE: This is NOT sent to the API. It's only used for client-side validation and local feature extraction. The actual photo stays in the browser."
    ),
  occasion: z.string().describe('The occasion for which the recommendation is needed.'),
  genre: z.string().describe('The preferred style genre (e.g., Formal, Casual, Streetwear).'),
  gender: z.string().describe('The gender of the person in the photo (male/female/neutral).'),
  weather: z.string().describe("The weather conditions at the person's current location."),
  skinTone: z.string().describe("The person's estimated skin tone (extracted client-side from the photo)."),
  dressColors: z.string().describe('A comma-separated list of the primary colors of the outfit (extracted client-side from the photo).'),
  previousRecommendation: z.string().optional().describe('A JSON string of a previous recommendation that the user was not satisfied with. If provided, generate a different recommendation.'),
  userId: z.string().optional().describe('User ID for personalization (if available)'),
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
    description: z.string().optional().describe('A short description of the outfit.'),
    colorPalette: z.array(z.string()).describe('3-4 key colors for this outfit in hex.'),
    imagePrompt: z.string().describe('Prompt to use with Imagen/Gemini image models to generate an outfit image.'),
    shoppingLinks: z.object({
      amazon: z.string().nullable(),
      flipkart: z.string().nullable(),
      myntra: z.string().nullable(),
    }).describe('Optional shopping links for the primary item(s) in this outfit.'),
    isExistingMatch: z.boolean().describe('True if the outfit matches well with current styling trends and user preferences.'),
    items: z.array(z.string()).describe('A list of 2-4 clothing items for this outfit.'),
  })).describe('A list of 2-3 complete outfit recommendations.'),
  notes: z.string().describe('A concluding pro tip or a gentle style note in a single sentence.'),
  imagePrompt: z.string().describe('A concise, descriptive prompt for an image generation model, describing the top recommended outfit on a mannequin or person.'),
  provider: z.enum(['gemini', 'groq']).optional().describe('The AI provider used for recommendations (gemini or groq).'),
});
export type AnalyzeImageAndProvideRecommendationsOutput = z.infer<typeof AnalyzeImageAndProvideRecommendationsOutputSchema>;

export async function analyzeImageAndProvideRecommendations(input: AnalyzeImageAndProvideRecommendationsInput): Promise<AnalyzeImageAndProvideRecommendationsOutput> {
  return analyzeImageAndProvideRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeImageAndProvideRecommendationsPrompt',
  input: {schema: AnalyzeImageAndProvideRecommendationsInputSchema},
  output: {schema: AnalyzeImageAndProvideRecommendationsOutputSchema},
  prompt: `You are a friendly, world-class fashion expert. Your task is to analyze a user's current outfit based on their clothing colors and provide alternative styling recommendations.

  **PRIVACY-FIRST APPROACH:**
  Note: The user's photo is NOT shared with you. All analysis is based on client-side extracted features (colors, skin tone) to protect user privacy.

  **User's Context:**
  - **Occasion:** {{{occasion}}}
  - **Genre Preference:** {{{genre}}}
  - **Gender:** {{{gender}}}
  - **Current Weather:** {{{weather}}}
  - **User's Skin Tone:** {{{skinTone}}} (extracted client-side from photo)
  - **User's Current Outfit Colors:** {{{dressColors}}} (extracted client-side from photo)

  {{#if validationFeedback}}
  **SCHEMA VALIDATION NOTICE:** {{{validationFeedback}}}
  - You previously omitted required JSON fields. This time produce a VALID JSON object that satisfies the output schema exactly.
  - Include every required top-level field: feedback, highlights, colorSuggestions (3-4 entries), outfitRecommendations (2-3 entries each with title, description, colorPalette (hex only), imagePrompt, shoppingLinks {amazon, flipkart, myntra}, isExistingMatch, items), notes, imagePrompt.
  - If exact shopping URLs are unknown, set the value to null but keep the keys.
  - Do not stop mid-sentence; provide complete content for each field.
  {{/if}}

  **PERSONALIZATION DATA (IMPORTANT - Use this to tailor recommendations):**
  {{#if personalizationData}}
  {{#if personalizationData.selectedOutfitHistory}}
  - **🎯 OUTFITS USER SELECTED & USED (HIGHEST PRIORITY):** {{{personalizationData.selectedOutfitHistory}}}
    → User explicitly chose these outfits to wear. This is the STRONGEST signal of preference!
    → Ensure AT LEAST 2 OUT OF 3 recommendations heavily feature these colors and styles
  {{/if}}
  {{#if personalizationData.stronglyPreferredColors}}
  - **Strongly Preferred Colors (from selections):** {{{personalizationData.stronglyPreferredColors}}} - Use these prominently in 2/3 recommendations
  {{/if}}
  {{#if personalizationData.frequentSelectionColors}}
  - **Most Selected Colors:** {{{personalizationData.frequentSelectionColors}}} - Include these in majority of recommendations
  {{/if}}
  {{#if personalizationData.stronglyPreferredStyles}}
  - **Strongly Preferred Styles (from selections):** {{{personalizationData.stronglyPreferredStyles}}} - Focus on these in 2/3 recommendations
  {{/if}}
  - **Favorite Colors:** {{{personalizationData.favoriteColors}}} - PRIORITIZE these colors in recommendations
  - **Disliked Colors:** {{{personalizationData.dislikedColors}}} - AVOID these colors completely
  - **Preferred Styles:** {{{personalizationData.preferredStyles}}} - Focus on these style preferences
  - **Avoided Styles:** {{{personalizationData.avoidedStyles}}} - Do not suggest these styles
  - **Current Season:** {{{personalizationData.season}}} - Consider seasonal appropriateness
  {{#if personalizationData.totalSelections}}
  - **Total Outfits User Selected:** {{{personalizationData.totalSelections}}} - User has actively chosen outfits {{personalizationData.totalSelections}} times
  {{/if}}
  {{#if personalizationData.occasionHistory}}
  - **Past Success for Similar Occasions:** {{{personalizationData.occasionHistory}}} - Reference these successful outfits
  {{/if}}
  {{/if}}

  **Your Guidelines:**

  **1. Outfit Analysis First:**
  - Based on the COLORS provided ({{{dressColors}}}), evaluate the current outfit color scheme.
  - Consider how these colors work together and with the user's skin tone ({{{skinTone}}}).
  - Assess the color combination for the given occasion and determine if it is:
    - **Perfect:** Appreciate the user's choice and suggest additional ideas for variety.
    - **Good but could be better:** Point out small improvements in color harmony or coordination.
    - **Not suitable:** Gently explain why the colors may not work well together or for the occasion, and recommend better alternatives.
  - Your analysis should form the basis of the "feedback" field. Always keep the tone positive and encouraging.

  **2. Recommendation Rules:**
  - Recommendations MUST perfectly match the occasion and genre.
  - **CRITICALLY IMPORTANT:** If favorite colors are provided, incorporate them prominently in your recommendations.
  - **CRITICALLY IMPORTANT:** If disliked colors are provided, DO NOT suggest them under any circumstances.
  - If preferred styles are provided, align recommendations with those styles.
  - If past successful outfits are mentioned, reference them as inspiration.
  - Adapt all suggestions for the weather.
  - Keep suggestions stylish but practical.
  - Mention specific color combinations that complement the user's skin tone.
  - Provide 2-3 distinct alternative outfit ideas.
  
  - Previous recommendation (if any): {{{previousRecommendation}}}
  If a previous recommendation is provided (non-empty), generate new, distinctly different recommendations and do not repeat ideas from that previous recommendation.

  **3. E-COMMERCE & SHOPPING:**
  - For each outfit, include a 'colorPalette' (3-4 hex colors) and set 'isExistingMatch' to true if the outfit aligns well with current fashion trends and user preferences.
  - Provide shopping suggestions with plain-text query terms that can be used to search marketplaces.

  **SHOPPING LINKS:**
  - For each outfit produce shopping link placeholders for Amazon, Flipkart and Myntra in 'shoppingLinks' (if you cannot provide exact URLs, set them to null and produce a short query term that can be used to search for similar items).
  - Example shopping link placeholders: "shoppingLinks": { "amazon": null, "flipkart": null, "myntra": null } and include "queryTerms": "navy tailored dress silver accessories" somewhere in the outfit description if links are not available.

  **Output Structure:**
  Your entire response MUST be a valid JSON object matching the output schema. Populate each field according to these instructions:
  - **feedback**: Your overall analysis of the user's current outfit (1-2 paragraphs).
  - **highlights**: Exactly 2-3 short, bullet-point-style highlights or key takeaways.
  - **colorSuggestions**: Exactly 3-4 complementary colors. Each MUST have: name, hex code (format: "#RRGGBB"), and reason.
  - **outfitRecommendations**: Exactly 2-3 distinct outfit suggestions. Each outfit MUST include:
    - title: Catchy name for the outfit
    - description: Short description of the outfit
    - colorPalette: Array of 3-4 hex color codes
    - imagePrompt: Detailed prompt for image generation
    - shoppingLinks: Object with amazon, flipkart, myntra (set to null if no URL available)
    - isExistingMatch: Boolean (true/false)
    - items: Array of 2-4 specific clothing items
  - **notes**: A final, single-sentence "pro tip" or style note.
  - **imagePrompt**: Based on your **first and best** outfit recommendation, create a concise prompt for an image generation model to create a photorealistic image of that outfit on a mannequin.
  
  CRITICAL: Ensure ALL fields are populated. Do not leave any required field empty or incomplete.
  `,
});

type GeminiModelCandidate = {
  name: string;
  retries: number;
};

// Only using models confirmed to work with Genkit v1.20.0
// gemini-2.0-flash-exp is the only model consistently available in v1beta
const GEMINI_MODEL_SEQUENCE: GeminiModelCandidate[] = [
  { name: 'googleai/gemini-2.0-flash-exp', retries: 5 },  // Increased retries for overload handling
];

const GEMINI_MODEL_CONFIG = {
  temperature: 0.5,        // Lower for faster, more deterministic responses
  maxOutputTokens: 1800,   // Reduced further - 2-3 outfits don't need 2048 tokens
  topK: 30,                // Lower for faster token sampling
  topP: 0.9,               // Slightly lower for speed
};

const RETRYABLE_ERROR_KEYWORDS = [
  'overloaded',
  '503',
  '429',
  'rate limit',
  'temporarily unavailable',
  'temporarily overloaded',
  'timeout',
  'quota',
  'resource exhausted',
];

const SCHEMA_ERROR_KEYWORD = 'schema validation failed';

function isRetryableError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_ERROR_KEYWORDS.some(keyword => message.toLowerCase().includes(keyword));
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function callModelWithRetry(
  enhancedInput: any,
  modelName: string,
  maxAttempts: number
): Promise<AnalyzeImageAndProvideRecommendationsOutput> {
  let attempt = 0;
  let lastError: unknown = null;
  let schemaRetries = 0;
  const MAX_SCHEMA_RETRIES = 2;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const { output } = await prompt(enhancedInput, {
        model: modelName,
        config: GEMINI_MODEL_CONFIG,
      });
      console.log(`✅ Successfully received response from ${modelName} on attempt ${attempt}`);
      // Add provider field to indicate Gemini was used
      const resultWithProvider = {
        ...output!,
        provider: 'gemini' as const,
      };
      return resultWithProvider;
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for schema validation errors first
      const schemaFeedback = extractSchemaFeedback(error);
      if (schemaFeedback && schemaRetries < MAX_SCHEMA_RETRIES) {
        schemaRetries++;
        console.warn(`🧭 Schema validation failed (attempt ${schemaRetries}/${MAX_SCHEMA_RETRIES}). Retrying with feedback...`);
        enhancedInput.validationFeedback = schemaFeedback;
        await sleep(500);
        continue;
      }

      // Check for retryable errors (overload, rate limit, etc.)
      if (isRetryableError(error) && attempt < maxAttempts) {
        // Exponential backoff: 2s, 4s, 8s, 16s, 32s with jitter
        const baseDelay = Math.min(2000 * Math.pow(2, attempt - 1), 32000);
        const jitter = Math.random() * 1000; // Add 0-1s random jitter
        const backoffMs = baseDelay + jitter;
        
        console.warn(
          `⚠️ Gemini API ${modelName} overloaded/rate-limited (attempt ${attempt}/${maxAttempts}). ` +
          `Error: "${errorMessage}". Retrying in ${Math.round(backoffMs / 1000)}s...`
        );
        await sleep(backoffMs);
        continue;
      }

      // Non-retryable error or max attempts reached
      if (attempt >= maxAttempts) {
        console.error(`❌ All ${maxAttempts} attempts failed for ${modelName}. Last error: ${errorMessage}`);
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown Gemini error');
}

function extractSchemaFeedback(error: unknown): string | null {
  if (!error) {
    return null;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  if (!lowerMessage.includes(SCHEMA_ERROR_KEYWORD)) {
    return null;
  }

  const missingMatches = [...message.matchAll(/required property '([^']+)'/g)].map(match => match[1]);
  const missingFields = missingMatches.length > 0 ? Array.from(new Set(missingMatches)).join(', ') : 'unspecified fields';
  const concise = `Previous response failed JSON schema validation. Missing or incomplete fields: ${missingFields}. Populate ALL required fields exactly as specified.`;
  return concise;
}

const analyzeImageAndProvideRecommendationsFlow = ai.defineFlow(
  {
    name: 'analyzeImageAndProvideRecommendationsFlow',
    inputSchema: AnalyzeImageAndProvideRecommendationsInputSchema,
    outputSchema: AnalyzeImageAndProvideRecommendationsOutputSchema,
  },
  async (input: AnalyzeImageAndProvideRecommendationsInput) => {
    // Fetch personalization data if userId is provided
    let enhancedInput = { ...input } as any;
    
    if (input.userId) {
      try {
        const personalizationContext = await getPersonalizationContext(input.userId, input.occasion);
        
        // Build personalization data for prompt
        if (personalizationContext.preferences) {
          const prefs = personalizationContext.preferences;
          const prefStrength = personalizationContext.preferenceStrength;
          
          enhancedInput.personalizationData = {
            favoriteColors: prefs.favoriteColors.join(', ') || 'none specified',
            dislikedColors: prefs.dislikedColors.join(', ') || 'none specified',
            preferredStyles: prefs.preferredStyles.join(', ') || 'none specified',
            avoidedStyles: prefs.avoidedStyles.join(', ') || 'none specified',
            season: personalizationContext.season,
            totalSelections: prefs.totalSelections || 0,
          };
          
          // Add strong preferences from selections (weight-based)
          if (prefStrength) {
            if (prefStrength.strongColors.length > 0) {
              enhancedInput.personalizationData.stronglyPreferredColors = prefStrength.strongColors.join(', ');
            }
            if (prefStrength.strongStyles.length > 0) {
              enhancedInput.personalizationData.stronglyPreferredStyles = prefStrength.strongStyles.join(', ');
            }
          }
          
          // Add selected outfit history (strongest signal)
          if (personalizationContext.selectedOutfits && personalizationContext.selectedOutfits.length > 0) {
            const selectedHistory = personalizationContext.selectedOutfits.map(outfit => 
              `${outfit.title} (${outfit.style}) - colors: ${outfit.colors.join(', ')}`
            ).join('; ');
            enhancedInput.personalizationData.selectedOutfitHistory = selectedHistory;
            
            // Extract most common colors from selections
            const selectionColors = personalizationContext.selectedOutfits
              .flatMap(o => o.colors)
              .slice(0, 5);
            if (selectionColors.length > 0) {
              enhancedInput.personalizationData.frequentSelectionColors = [...new Set(selectionColors)].join(', ');
            }
          }
          
          // Add occasion-specific history if available
          if (personalizationContext.occasionPrefs) {
            const occasionHistory = `Previously worn: ${personalizationContext.occasionPrefs.preferredItems.join(', ')} in colors ${personalizationContext.occasionPrefs.preferredColors.join(', ')}`;
            enhancedInput.personalizationData.occasionHistory = occasionHistory;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch personalization data, proceeding without:', error);
        // Continue without personalization if it fails
      }
    }
    
    // Try Groq FIRST (14,400/day FREE) - Primary recommendation engine
    if (isGroqConfigured()) {
      try {
        console.log('🚀 Using Groq AI as primary recommendation engine (14,400/day FREE)...');
        
        // Prepare Groq input from enhanced input
        const groqInput = {
          occasion: input.occasion,
          genre: input.genre,
          gender: input.gender,
          weather: input.weather,
          skinTone: input.skinTone,
          dressColors: input.dressColors,
          previousRecommendation: input.previousRecommendation,
        };
        
        const groqResult = await generateRecommendationsWithGroq(groqInput);
        console.log('✅ Groq response received - recommendations generated successfully!');
        
        // Extract colors from outfit recommendations for color palette
        const allColors = new Set<string>();
        groqResult.outfitRecommendations.forEach(rec => {
          rec.colorPalette?.forEach(color => allColors.add(color));
        });
        const colorPalette = Array.from(allColors).slice(0, 4);
        
        // Convert Groq format to match output schema
        // Helper to ensure hex format for colors
        const ensureHexColor = (color: string): string => {
          if (color.startsWith('#')) return color;
          // Convert color names to hex or generate a random hex
          const colorMap: Record<string, string> = {
            'navy': '#000080', 'navy blue': '#000080', 'cream': '#FFFDD0', 'burgundy': '#800020',
            'black': '#000000', 'white': '#FFFFFF', 'gray': '#808080', 'beige': '#F5F5DC',
            'red': '#FF0000', 'blue': '#0000FF', 'green': '#008000', 'brown': '#A52A2A',
          };
          return colorMap[color.toLowerCase()] || `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
        };

        const convertedResult: AnalyzeImageAndProvideRecommendationsOutput = {
          feedback: groqResult.styleAnalysis.currentStyle,
          highlights: groqResult.styleAnalysis.strengths.slice(0, 3),
          colorSuggestions: colorPalette.map((color, i) => ({
            name: color,
            hex: ensureHexColor(color),
            reason: `Complements your ${input.skinTone} skin tone and ${input.occasion} occasion.`,
          })),
          outfitRecommendations: groqResult.outfitRecommendations.map(rec => ({
            title: rec.title,
            description: rec.description,
            colorPalette: (rec.colorPalette || []).map(c => ensureHexColor(c)),
            imagePrompt: rec.imagePrompt || `${rec.title}: ${rec.description}. Items: ${rec.items.join(', ')}`,
            shoppingLinks: {
              amazon: rec.shoppingLinks?.amazon || null,
              flipkart: rec.shoppingLinks?.flipkart || null,
              myntra: rec.shoppingLinks?.myntra || null,
            },
            isExistingMatch: rec.isExistingMatch || false,
            items: rec.items,
          })),
          notes: groqResult.seasonalAdvice,
          imagePrompt: groqResult.outfitRecommendations[0]?.imagePrompt 
            || `${groqResult.outfitRecommendations[0]?.title}: ${groqResult.outfitRecommendations[0]?.description}`
            || 'Stylish outfit for ' + input.occasion,
          provider: 'groq',
        };
        
        return convertedResult;
      } catch (groqError) {
        console.warn('⚠️ Groq failed, falling back to Gemini...', groqError);
        // Continue to Gemini fallback below
      }
    } else {
      console.log('⚠️ Groq not configured, using Gemini...');
    }

    // Groq failed or not configured - try Gemini as backup
    console.log('🎨 Calling Gemini API as backup...');

    let lastGeminiError: unknown = null;
    for (const candidate of GEMINI_MODEL_SEQUENCE) {
      try {
        console.log(`🔁 Trying Gemini model ${candidate.name} (up to ${candidate.retries} attempt(s))`);
        return await callModelWithRetry(enhancedInput, candidate.name, candidate.retries);
      } catch (error) {
        lastGeminiError = error;
        
        // Check if it's a schema error - if so, try next model
        const schemaFeedback = extractSchemaFeedback(error);
        if (schemaFeedback) {
          console.warn(`⚠️ Gemini model ${candidate.name} failed schema validation after retries. Trying next model...`);
          continue;
        }

        // Check if it's a retryable error (overload, etc) - if so, try next model
        if (isRetryableError(error)) {
          console.warn(`⚠️ Gemini model ${candidate.name} is overloaded. Moving to fallback model...`);
          continue;
        }

        // Non-retryable error - throw immediately
        console.error(`❌ Gemini model ${candidate.name} failed with non-retryable error.`, error);
        throw error;
      }
    }

    // Both Groq and Gemini failed
    const errorMessage = lastGeminiError instanceof Error ? lastGeminiError.message : String(lastGeminiError);
    
    // Both services failed
    if (isRetryableError(lastGeminiError)) {
      throw new Error(
        'Our AI service is experiencing high demand right now. ' +
        'Please wait 30-60 seconds and try again. ' +
        'We apologize for the inconvenience!'
      );
    }
    
    throw new Error(
      `Style analysis temporarily unavailable: ${errorMessage}. ` +
      'Please try again in a few moments or contact support if the issue persists.'
    );
  }
);
