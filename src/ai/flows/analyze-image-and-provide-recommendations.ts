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
import crypto from 'crypto';
import { getComprehensivePreferences } from '@/lib/preference-engine';
import { getBlocklists } from '@/lib/blocklist-manager';

// ============================================
// AI RESPONSE CACHE (10-minute TTL)
// ============================================
interface CachedAIResponse {
  data: AnalyzeImageAndProvideRecommendationsOutput;
  timestamp: number;
  userId?: string;
}

const aiResponseCache = new Map<string, CachedAIResponse>();
const AI_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function generateCacheKey(input: AnalyzeImageAndProvideRecommendationsInput): string {
  // Generate cache key from image hash + context (not full personalization to allow sharing)
  const imageHash = crypto
    .createHash('sha256')
    .update(input.photoDataUri)
    .digest('hex')
    .substring(0, 16);
  
  return `ai:${imageHash}:${input.occasion}:${input.gender}:${input.weather}:${input.genre}:${input.skinTone}`;
}

function getCachedAIResponse(key: string): AnalyzeImageAndProvideRecommendationsOutput | null {
  const cached = aiResponseCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > AI_CACHE_TTL) {
    aiResponseCache.delete(key);
    return null;
  }
  
  console.log('⚡ [CACHE HIT] Using cached AI analysis - instant response!');
  return cached.data;
}

function setCachedAIResponse(key: string, data: AnalyzeImageAndProvideRecommendationsOutput, userId?: string): void {
  aiResponseCache.set(key, { data, timestamp: Date.now(), userId });
  
  // Auto-cleanup old entries
  if (aiResponseCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of aiResponseCache.entries()) {
      if (now - v.timestamp > AI_CACHE_TTL) {
        aiResponseCache.delete(k);
      }
    }
  }
}

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
    reason: z.string().optional().describe('A short sentence on why this color is recommended (optional for palette display).'),
  })).describe('An array of 8-10 recommended colors with their hex codes. These should be diverse and visually distinct for accurate outfit matching.'),
  outfitRecommendations: z.array(z.object({
    title: z.string().describe('A catchy title for the outfit (e.g., "Chic Casual Look").'),
    description: z.string()
      .min(100, 'Description must be at least 100 characters - write 3 complete sentences')
      .describe('MUST be AT LEAST 3 COMPLETE SENTENCES describing the outfit in detail. Include information about styling, versatility, and why it works for the occasion.'),
    colorPalette: z.array(z.string()).describe('3-4 key colors for this outfit in hex.'),
    styleType: z.string().describe('The fashion style category (e.g., casual, formal, streetwear, bohemian, minimalist, vintage, sporty).'),
    occasion: z.string().describe('The specific occasion or event where this outfit would be appropriate (e.g., office, date night, casual brunch, night out, business meeting).'),
    imagePrompt: z.string().describe('Prompt to use with Imagen/Gemini image models to generate an outfit image.'),
    shoppingLinks: z.object({
      amazon: z.string().nullable(),
      tatacliq: z.string().nullable(),
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
  // Check cache first for instant response on repeat queries
  const cacheKey = generateCacheKey(input);
  const cached = getCachedAIResponse(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Generate new response
  const result = await analyzeImageAndProvideRecommendationsFlow(input);
  
  // Cache for future use
  setCachedAIResponse(cacheKey, result, input.userId);
  
  return result;
}

const prompt = ai.definePrompt({
  name: 'analyzeImageAndProvideRecommendationsPrompt',
  input: {schema: AnalyzeImageAndProvideRecommendationsInputSchema},
  output: {schema: AnalyzeImageAndProvideRecommendationsOutputSchema},
  prompt: `You are a highly acclaimed, celebrity fashion stylist with 15+ years of experience working with A-list clients, fashion magazines, and runway shows. Your expertise spans color theory, body proportions, cultural fashion trends, and seasonal styling. You have an exceptional eye for detail and can create magazine-worthy looks that make people feel confident and stylish.

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
  - Include every required top-level field: feedback, highlights, colorSuggestions (8-10 entries), outfitRecommendations (2-3 entries each with title, description, colorPalette (hex only), imagePrompt, shoppingLinks {amazon, tatacliq, myntra}, isExistingMatch, items), notes, imagePrompt.
  - If exact shopping URLs are unknown, set the value to null but keep the keys.
  - Do not stop mid-sentence; provide complete content for each field.
  {{/if}}

  **PERSONALIZATION DATA (CRITICAL - This determines user satisfaction):**
  {{#if personalizationData}}
  {{#if personalizationData.selectedOutfitHistory}}
  - **🎯 OUTFITS USER ACTUALLY SELECTED & WORE (TOP PRIORITY):** {{{personalizationData.selectedOutfitHistory}}}
    → These are outfits the user LOVED enough to wear! This is your BEST signal of what works for them.
    → **MANDATE:** AT LEAST 2 OUT OF 3 recommendations MUST heavily incorporate these exact colors and similar style elements
    → The user has proven they trust and enjoy these combinations - don't deviate too much!
  {{/if}}
  {{#if personalizationData.stronglyPreferredColors}}
  - **💎 Strongly Preferred Colors (from repeated selections):** {{{personalizationData.stronglyPreferredColors}}}
    → Use these prominently in 2/3 recommendations - they're the user's "safe zone"
  {{/if}}
  {{#if personalizationData.frequentSelectionColors}}
  - **⭐ Most Selected Colors Overall:** {{{personalizationData.frequentSelectionColors}}}
    → Include these in the majority of recommendations for consistency
  {{/if}}
  {{#if personalizationData.stronglyPreferredStyles}}
  - **👔 Strongly Preferred Styles (from selections):** {{{personalizationData.stronglyPreferredStyles}}}
    → Focus on these in 2/3 recommendations - this is what the user gravitates toward
  {{/if}}
  - **❤️ Favorite Colors (user-declared):** {{{personalizationData.favoriteColors}}}
    → PRIORITIZE these colors prominently in ALL recommendations
  - **🚫 DISLIKED Colors (user-declared):** {{{personalizationData.dislikedColors}}}
    → **ABSOLUTELY AVOID** these colors under ANY circumstances - they're deal-breakers!
  - **✅ Preferred Styles:** {{{personalizationData.preferredStyles}}}
    → Align your recommendations with these style preferences
  - **❌ Avoided Styles:** {{{personalizationData.avoidedStyles}}}
    → Do NOT suggest these styles - the user has explicitly rejected them
  - **🌸 Current Season:** {{{personalizationData.season}}}
    → Ensure all recommendations are seasonally appropriate
  {{#if personalizationData.totalSelections}}
  - **📊 Total Outfits Selected:** {{{personalizationData.totalSelections}}} times
    → This user has actively engaged {{personalizationData.totalSelections}} times - respect their established preferences!
  {{/if}}
  {{#if personalizationData.occasionHistory}}
  - **🎉 Past Success for Similar Occasions:** {{{personalizationData.occasionHistory}}}
    → Reference and build upon these successful outfit choices
  {{/if}}
  {{/if}}

  **Your Expert Analysis Framework:**

  **1. COMPREHENSIVE COLOR & OUTFIT ANALYSIS:**
  Based on the user's current outfit colors ({{{dressColors}}}), provide a professional assessment:
  
  **Color Harmony Analysis:**
  - Evaluate the color combination using professional color theory (complementary, analogous, triadic, monochromatic schemes)
  - Assess how these specific colors interact with the user's skin tone ({{{skinTone}}})
  - Consider color temperature (warm vs cool) and its impact on the overall look
  - Analyze color proportions and balance in the outfit
  
  **Occasion Appropriateness:**
  - Critically evaluate if the current color scheme matches the formality level of "{{{occasion}}}"
  - Consider cultural and social appropriateness of the colors for this specific event
  - Assess whether the colors convey the right message (professional, playful, elegant, etc.)
  
  **Weather Consideration:**
  - Evaluate if colors are seasonally appropriate for "{{{weather}}}"
  - Consider psychological impact of colors in different weather conditions
  
  **Professional Verdict:**
  Rate the outfit as:
  - **"Absolutely Stunning!"** - Perfect color harmony, occasion-appropriate, skin tone flattering
  - **"Great Foundation, Small Tweaks"** - Good base with minor improvements needed in color balance or accessories
  - **"Needs Refinement"** - Colors clash or don't suit the occasion; provide specific, actionable improvements
  
  Your feedback should be warm, encouraging, yet professionally honest. Use specific color theory terminology when appropriate.

  **2. STRATEGIC RECOMMENDATION RULES (CRITICAL FOR USER SATISFACTION):**
  
  **Priority Order for Recommendations:**
  1. **FIRST:** User's explicitly selected outfits (selectedOutfitHistory) - these are PROVEN winners
  2. **SECOND:** User's favorite colors (favoriteColors) - they love these
  3. **THIRD:** Occasion and weather requirements - must be appropriate
  4. **FOURTH:** Complementary colors for their skin tone - flattering choices
  5. **FIFTH:** Current fashion trends - modern and stylish
  
  **Mandatory Requirements:**
  - ✅ Recommendations MUST perfectly align with "{{{occasion}}}" and "{{{genre}}}" preferences
  - ✅ If favorite colors exist, AT LEAST 2 of 3 outfits MUST prominently feature them
  - 🚫 NEVER suggest disliked colors - this is non-negotiable
  - ✅ If selectedOutfitHistory exists, 2 of 3 recommendations should heavily reference those color combinations and styles
  - ✅ All suggestions must be weather-appropriate for "{{{weather}}}"
  - ✅ Each outfit should include specific styling details (textures, patterns, accessories)
  - ✅ Provide expert reasoning for why each color choice flatters their {{{skinTone}}} skin tone
  - ✅ Include one "safe" recommendation, one "elevated" recommendation, and one "fashion-forward" recommendation
  
  **Previous Recommendation Handling:**
  {{#if previousRecommendation}}
  Previous recommendation: {{{previousRecommendation}}}
  
  **IMPORTANT:** The user wasn't satisfied with the above. Create COMPLETELY DIFFERENT recommendations:
  - Use different color palettes
  - Suggest different style approaches
  - Offer alternative silhouettes and combinations
  - Think outside the box while staying true to user preferences
  {{/if}}

  **3. DETAILED COLOR PALETTE & E-COMMERCE INTEGRATION:**
  
  **Color Suggestions (8-10 diverse colors):**
  - Provide a sophisticated, well-curated color palette with MAXIMUM visual diversity
  - Include colors across the spectrum: neutrals, jewel tones, pastels, earth tones, bold accents
  - Each color MUST have:
    * **name**: Evocative, fashion-forward name (e.g., "Midnight Navy" not just "Blue", "Champagne Gold" not just "Gold")
    * **hex**: Exact hex code in format "#RRGGBB" (e.g., "#1A237E", "#F5E6D3")
    * **reason**: Specific explanation of why this color works (e.g., "Creates stunning contrast with your warm skin tone and adds sophistication to casual looks")
  - Ensure colors complement the user's {{{skinTone}}} skin tone using professional color theory
  - Include colors that work across different seasons and occasions
  - Make each color perceptually distinct (avoid similar shades like #FF0000 and #FF1111)
  
  **Outfit Recommendations (2-3 complete looks):**
  Each outfit must be meticulously detailed and ready-to-wear:
  
  **OUTFIT STRUCTURE:**
  - **title**: Creative, aspirational name (e.g., "The Modern Minimalist", "Coastal Elegance", "Urban Edge")
  - **description**: MANDATORY - EXACTLY 3 COMPLETE SENTENCES (minimum 100 characters)
    * ⚠️ CRITICAL: You MUST write EXACTLY 3 full sentences ending with periods. Not 1 sentence. Not 2 sentences. EXACTLY 3 SENTENCES.
    * Sentence 1: Describe the overall aesthetic and main pieces (30-40 words)
    * Sentence 2: Detail how the pieces work together, styling notes, textures (30-40 words)  
    * Sentence 3: Explain versatility, occasion suitability, or why it's perfect (30-40 words)
    * Example: "This sophisticated ensemble combines a tailored navy blazer with crisp white trousers for effortless elegance. The structured silhouette is softened with a silk blouse in dusty rose, creating perfect balance. Perfect for business meetings or dinner dates, this outfit transitions seamlessly from day to evening."
  - **colorPalette**: Array of EXACTLY 3-4 hex codes ONLY - these should be the dominant colors in the outfit
    * Format: ["#1A237E", "#FFFFFF", "#C0C0C0", "#8B4513"]
    * DO NOT include color names, only hex codes
    * Ensure high contrast for visual interest
  - **imagePrompt**: ULTRA-DETAILED, PROFESSIONAL FASHION CATALOG PROMPT (150-200 words):
    * **Photography Style**: Specify "professional fashion catalog photography", "high-end retail catalog", or "luxury brand product photography"
    * **Subject & Display**: Full-body shot, outfit displayed on WHITE MANNEQUIN, professional retail display (centered, front-facing, or slight angle)
    * **Clothing Details**: Exact garments with fabric types, textures, cuts, and fit (e.g., "tailored navy (#1A237E) wool blazer with notched lapels, structured shoulders, and gold horn buttons")
    * **Color Precision**: Use exact hex codes from colorPalette throughout (e.g., "crisp white (#FFFFFF) silk crepe blouse with French cuffs")
    * **Styling Details**: Layering, proportions, tucking, rolling, draping (e.g., "blouse tucked into high-waisted trousers, blazer sleeves pushed to three-quarter length")
    * **Accessories**: Specific items with materials and colors (e.g., "cognac brown (#8B4513) Italian leather belt with brass buckle, matching pointed-toe pumps, delicate 14k gold chain necklace")
    * **Lighting**: "studio lighting with soft diffused key light", "natural window light", "golden hour lighting", or "bright even lighting with soft shadows"
    * **Background**: "clean white seamless backdrop", "minimal grey studio background", "soft bokeh effect", or "modern interior setting"
    * **Image Quality**: Include terms like "high resolution", "sharp focus", "professional quality", "magazine-ready", "8K quality"
    * **Mood & Aesthetic**: "elegant and sophisticated", "effortlessly chic", "modern minimalist", "polished professional"
    * **Technical Details**: "shot with 85mm lens", "shallow depth of field", "centered composition", "vertical format"
    * Example: "Professional fashion editorial photography of a confident woman in a full-body shot. She wears a tailored navy blue (#1A237E) wool blazer with notched lapels and structured shoulders, layered over a crisp white (#FFFFFF) silk crepe blouse with subtle sheen. Paired with charcoal grey (#C0C0C0) wide-leg trousers with pressed center crease. Cognac brown (#8B4513) Italian leather belt with brass buckle cinches the waist. Matching pointed-toe leather pumps. Minimalist 14k gold jewelry: delicate chain necklace and small hoop earrings. Hair styled in a sleek low bun. Model stands confidently with slight angle, one hand at side, other relaxed. Studio lighting with soft diffused key light from 45-degree angle creating subtle shadows. Clean white seamless backdrop. High resolution, sharp focus throughout, professional quality, magazine-ready aesthetic. Shot with 85mm portrait lens, shallow depth of field, centered composition. Elegant and sophisticated mood, polished professional style."
  - **items**: Array of 3-5 specific, shoppable items:
    * Be VERY specific (e.g., "Navy cashmere turtleneck sweater" not just "sweater")
    * Include fabric types, cuts, and key details
    * Make items realistic and available in retail
    * Consider layering and seasonal appropriateness
  - **shoppingLinks**: Provide searchable keywords for each platform:
    * amazon: null (but mention good search terms in description)
    * tatacliq: null (but mention good search terms in description)
    * myntra: null (but mention good search terms in description)
    * Include a "queryTerms" note in the description like: "Search for: 'navy wool blazer women professional' on any platform"
  - **isExistingMatch**: true if outfit aligns with current trends AND user preferences, false otherwise
  
  **4. EXPERT STYLING GUIDANCE:**
  
  **Highlights (2-3 key takeaways):**
  - Make these actionable, specific, and confidence-boosting
  - Focus on what makes the user's style unique and how to enhance it
  - Examples: 
    * "Your {{{dressColors}}} palette shows sophisticated color sense - elevate it with metallic accessories"
    * "Your {{{skinTone}}} skin tone is beautifully complemented by jewel tones - don't shy away from bold colors"
    * "For {{{occasion}}}, balance is key - pair bold tops with neutral bottoms or vice versa"
  
  **Notes (final pro tip):**
  - One powerful, memorable sentence that the user will remember
  - Should feel personal and expert
  - Examples:
    * "Remember: confidence is your best accessory - wear what makes you feel unstoppable!"
    * "The secret to effortless style? Invest in quality basics and have fun with statement pieces."
    * "Your personal style evolution is a journey - embrace experimenting while staying true to what feels authentically you."

  **Output Structure:**
  Your response MUST be a perfectly valid JSON object. Every field is REQUIRED and CRITICAL for user experience:
  
  - **feedback**: 2-3 paragraphs of professional, warm analysis of their current outfit colors
    * Paragraph 1: Color harmony assessment using professional terminology
    * Paragraph 2: How colors work with skin tone and occasion
    * Paragraph 3: Overall verdict with encouraging next steps
  
  - **highlights**: EXACTLY 2-3 bullet points (short, impactful sentences)
    * Each should be immediately actionable
    * Focus on positive reinforcement and quick wins
    * Example format: "Your navy and white combo shows sophisticated taste - add gold accessories for extra polish"
  
  - **colorSuggestions**: EXACTLY 8-10 diverse colors (required)
    * Each color object MUST include: name (string), hex (string, format "#RRGGBB"), reason (string)
    * Ensure maximum perceptual diversity across the palette
    * Cover the spectrum: neutrals, brights, pastels, earth tones, jewel tones
    * Example: {"name": "Midnight Navy", "hex": "#1A237E", "reason": "Creates sophisticated depth and complements your warm skin tone beautifully"}
  
  - **outfitRecommendations**: EXACTLY 2-3 complete outfits (required)
    Each outfit object MUST include ALL of these fields:
    * **title** (string): Creative, aspirational outfit name
    * **description** (string): MANDATORY - MUST BE EXACTLY 3 COMPLETE SENTENCES (minimum 100 characters total)
      - **CRITICAL REQUIREMENT:** Write EXACTLY 3 full sentences. Not 1. Not 2. EXACTLY 3 SENTENCES.
      - Sentence 1: Describe the overall look and key pieces (e.g., "This sophisticated ensemble combines...")
      - Sentence 2: Explain styling details and how pieces work together (e.g., "The structured silhouette is softened...")
      - Sentence 3: Highlight versatility, occasions, or why it's perfect for the user (e.g., "Perfect for business meetings...")
      - Example of CORRECT 3-sentence format: "This sophisticated ensemble combines a tailored navy blazer with crisp white trousers for effortless elegance. The structured silhouette is softened with a silk blouse in dusty rose, creating perfect balance. Perfect for business meetings or dinner dates, this outfit transitions seamlessly from day to evening."
      - ❌ WRONG: "Great casual look with jeans and a sweater." (Only 1 sentence - REJECTED)
      - ✅ CORRECT: "This casual weekend look pairs dark wash jeans with a cozy cream knit sweater. The relaxed fit is elevated with structured accessories and ankle boots in cognac brown. Perfect for brunch, shopping, or casual Friday at the office."
    * **colorPalette** (array): EXACTLY 3-4 hex codes ONLY in format ["#RRGGBB", "#RRGGBB", ...]
      - NO color names allowed in this array, ONLY hex codes
      - Must match colors used in imagePrompt
    * **styleType** (string): The fashion style category (e.g., casual, formal, streetwear, bohemian, minimalist, vintage, sporty)
      - Should match the overall aesthetic of the outfit
      - Be specific and descriptive
    * **occasion** (string): Specific occasion where this outfit would be appropriate
      - Examples: "office", "date night", "casual brunch", "night out", "business meeting", "weekend shopping", "cocktail party"
      - Should align with the user's input occasion but can be more specific
    * **imagePrompt** (string): PROFESSIONAL FASHION CATALOG PROMPT (150-200 words)
      - **START WITH:** "Professional fashion catalog photography" or "High-end retail catalog style"
      - **Subject:** Full-body shot, outfit displayed on WHITE MANNEQUIN, professional retail display (centered, front-facing, or slight angle)
      - **Garments:** Ultra-specific with fabric types, textures, cuts (e.g., "tailored navy wool blazer with notched lapels and structured shoulders")
      - **Colors:** Use EXACT hex codes from colorPalette (e.g., "navy (#1A237E)", "white (#FFFFFF)")
      - **Styling:** Details like tucking, rolling, layering, proportions (e.g., "blouse tucked, blazer sleeves pushed to three-quarter")
      - **Accessories:** Specific items with materials/colors (e.g., "cognac Italian leather belt with brass buckle, matching pumps")
      - **Lighting:** ALWAYS specify: "studio lighting with soft diffused key light" OR "natural window light with soft shadows"
      - **Background:** ALWAYS specify: "clean white seamless backdrop" OR "minimal grey studio background with soft bokeh"
      - **Quality:** Include: "high resolution, sharp focus, professional quality, magazine-ready aesthetic"
      - **Technical:** Add: "shot with 85mm portrait lens, shallow depth of field, centered composition"
      - **Mood:** Describe aesthetic: "elegant and sophisticated", "effortlessly chic", "modern minimalist"
      - Make it photorealistic and editorial-quality
    * **shoppingLinks** (object): Must include all three keys:
      - amazon: null
      - tatacliq: null
      - myntra: null
      (Include search terms in description instead)
    * **isExistingMatch** (boolean): true/false based on trends and user preferences
    * **items** (array): 3-5 specific clothing items (very detailed)
      - Include fabric, color, style details
      - Example: "Tailored charcoal grey wool trousers with subtle pinstripes"
  
  - **notes**: One powerful, memorable sentence (final pro tip)
    * Make it personal, warm, and confidence-boosting
    * Should feel like advice from a trusted stylist friend
  
  - **imagePrompt**: PROFESSIONAL FASHION CATALOG PROMPT for your #1 recommended outfit (150-200 words)
    * **MANDATORY ELEMENTS:**
      - Photography type: "Professional fashion catalog photography" or "high-end retail catalog style"
      - Display: Full-body shot, outfit on WHITE MANNEQUIN, professional retail display
      - Clothing description: Ultra-specific with fabric types, cuts, and exact hex colors from colorPalette
      - Styling details: Proportions, layering, tucking, draping specifics
      - Accessories: Complete with materials and colors
      - Lighting: "studio lighting with soft diffused key light" or "natural window light with soft shadows"
      - Background: "clean white seamless backdrop" or "minimal grey studio background"
      - Quality terms: "high resolution", "sharp focus", "professional quality", "magazine-ready", "8K quality"
      - Technical: "shot with 85mm lens", "shallow depth of field", "centered composition"
      - Mood: Describe the overall aesthetic (elegant, modern, casual-chic, etc.)
    * Make it vivid, specific, and ready for AI image generation
    * Focus on creating a polished, editorial-quality visual
  
  **CRITICAL VALIDATION CHECKLIST:**
  ✅ feedback is 2-3 complete paragraphs (not empty)
  ✅ highlights is array with 2-3 strings (not empty)
  ✅ colorSuggestions is array with 8-10 color objects (each with name, hex, reason)
  ✅ outfitRecommendations is array with 2-3 outfit objects (each complete with ALL required fields)
  ✅ colorPalette in each outfit contains ONLY hex codes, NO color names
  ✅ notes is one complete sentence
  ✅ imagePrompt is detailed and complete
  ✅ No fields are null, undefined, or incomplete
  
  Remember: You are the user's personal celebrity stylist. Make them feel seen, understood, and excited about their style journey!
  `,
});

type GeminiModelCandidate = {
  name: string;
  retries: number;
};

// Only using models confirmed to work with Genkit v1.20.0
// Avoid experimental "-exp" variants to reduce heavy/slow compute and quota pressure
const GEMINI_MODEL_SEQUENCE: GeminiModelCandidate[] = [
  { name: 'googleai/gemini-2.0-flash', retries: 3 },
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
        // ✨ NEW: Fetch comprehensive preferences for personalization
        let userPreferences = null;
        let userBlocklists = null;
        
        if (input.userId && input.userId !== 'anonymous') {
          try {
            [userPreferences, userBlocklists] = await Promise.all([
              getComprehensivePreferences(input.userId),
              getBlocklists(input.userId),
            ]);
            console.log('✅ [AI Flow] Preferences loaded for Groq:', {
              interactions: userPreferences.totalInteractions,
              confidence: userPreferences.overallConfidence,
            });
          } catch (prefError) {
            console.warn('⚠️ [AI Flow] Failed to load preferences for Groq:', prefError);
          }
        }
        
        const groqInput = {
          occasion: input.occasion,
          genre: input.genre,
          gender: input.gender,
          weather: input.weather,
          skinTone: input.skinTone,
          dressColors: input.dressColors,
          previousRecommendation: input.previousRecommendation,
          // ✨ NEW: Pass personalization data to Groq
          userId: input.userId,
          userPreferences: userPreferences || undefined,
          userBlocklists: userBlocklists || undefined,
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
            styleType: rec.styleType || input.genre || 'casual',
            occasion: rec.occasion || input.occasion,
            imagePrompt: rec.imagePrompt || `${rec.title}: ${rec.description}. Items: ${rec.items.join(', ')}`,
            shoppingLinks: {
              amazon: rec.shoppingLinks?.amazon || null,
              tatacliq: rec.shoppingLinks?.tatacliq || null,
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
