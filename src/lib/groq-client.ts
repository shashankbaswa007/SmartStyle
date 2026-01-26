/**
 * Groq API client for AI-powered fashion recommendations
 * Used as fallback when Gemini quota is exceeded
 * Enhanced with personalization support
 */

import Groq from 'groq-sdk';
import { ComprehensivePreferences } from './preference-engine';
import { Blocklists } from './blocklist-manager';
import { buildPersonalizedPrompt, PersonalizationContext } from './prompt-personalizer';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export interface GroqRecommendationInput {
  occasion: string;
  genre?: string;
  gender?: string;
  weather?: string;
  skinTone?: string;
  dressColors?: string;
  previousRecommendation?: any;
  // NEW: Personalization data
  userId?: string;
  userPreferences?: ComprehensivePreferences;
  userBlocklists?: Blocklists;
}

export interface GroqOutfitRecommendation {
  title: string;
  description: string;
  items: string[];
  colorPalette: string[];
  styleType?: string;
  occasion?: string;
  stylingTips: string[];
  imagePrompt: string;
  shoppingLinks?: {
    amazon?: string;
    tatacliq?: string;
    myntra?: string;
  };
  isExistingMatch?: boolean;
}

export interface GroqStyleAnalysis {
  outfitRecommendations: GroqOutfitRecommendation[];
  styleAnalysis?: {
    currentStyle: string;
    strengths: string[];
    improvements: string[];
  };
  seasonalAdvice?: string;
}

/**
 * Generate fashion recommendations using Groq's Llama 3.3 70B model
 * Enhanced with personalization support
 */
export async function generateRecommendationsWithGroq(
  input: GroqRecommendationInput
): Promise<GroqStyleAnalysis> {
  const hasPersonalization = input.userId && input.userPreferences && input.userBlocklists;
  
  console.log('🤖 Using Groq AI for recommendations...', {
    personalized: hasPersonalization,
    interactions: input.userPreferences?.totalInteractions || 0,
  });

  const prompt = buildGroqPrompt(input);

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert fashion stylist and personal shopper with deep knowledge of:
- Color theory and seasonal color analysis
- Body type styling and flattering silhouettes
- Occasion-appropriate dressing for various events
- Current fashion trends and timeless style principles
- Sustainable and versatile wardrobe building
- Cultural and regional fashion preferences
${hasPersonalization ? '\n- Personalized styling based on user\'s historical preferences and behavior' : ''}

You provide detailed, actionable outfit recommendations that are practical, stylish, and appropriate for the user's needs. ${hasPersonalization ? 'You pay special attention to the user\'s established preferences, favorite colors, and past outfit choices to create highly personalized recommendations.' : ''} Always respond in valid JSON format.

🚨 CRITICAL DIVERSITY REQUIREMENTS 🚨
Each of your 3 outfit recommendations MUST be COMPLETELY DIFFERENT:
- DIFFERENT style types (e.g., casual, formal, streetwear, bohemian, minimalist, vintage)
- DIFFERENT color schemes (vary light/dark, warm/cool, neutral/bold, monochrome/multicolor)
- DIFFERENT silhouettes and fits (e.g., relaxed, tailored, oversized, fitted)
- DIFFERENT vibes and aesthetics (e.g., professional, edgy, romantic, sporty)
- DIFFERENT items (no repeating the same clothing pieces across outfits)

Think of each outfit as targeting a DIFFERENT personality or interpretation of the occasion.
NEVER generate similar or repetitive recommendations - make each one UNIQUE and DISTINCT.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile', // Updated: llama-3.1-70b-versatile was deprecated Oct 2025
      temperature: 0.95, // OPTIMIZED: Balanced for diversity without incoherence
      max_tokens: 1500, // OPTIMIZED: Reduced from 2048 (sufficient for structured JSON)
      stream: true, // OPTIMIZED: Enable streaming for faster TTFB
      response_format: { type: 'json_object' },
      top_p: 0.92, // Balanced for diverse but coherent outputs
      frequency_penalty: 1.5, // MAXIMUM: Strongest penalty for repetition
      presence_penalty: 1.2, // HIGH: Strong encouragement for new topics
    });

    // Handle streaming response
    let responseText = '';
    
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || '';
      responseText += content;
    }

    if (!responseText || responseText === '{}') {
      throw new Error('Empty response from Groq');
    }
    
    console.log('✅ Groq streaming response received');

    // Parse JSON response with error handling
    let analysis: GroqStyleAnalysis;
    try {
      analysis = JSON.parse(responseText) as GroqStyleAnalysis;
    } catch (parseError) {
      console.error('❌ Failed to parse Groq response:', parseError);
      console.error('Response text:', responseText.substring(0, 500));
      throw new Error('Invalid JSON response from Groq - the AI returned malformed data');
    }

    // Validate response
    if (!analysis.outfitRecommendations || analysis.outfitRecommendations.length === 0) {
      throw new Error('Invalid response from Groq: no recommendations generated');
    }

    // Validate diversity - ensure recommendations are actually different
    const diversity = validateDiversity(analysis.outfitRecommendations);
    if (diversity.score < 60) {
      console.warn('⚠️ Low diversity detected:', diversity.reason, '- Score:', diversity.score);
      console.warn('📋 Outfit titles:', analysis.outfitRecommendations.map(r => ({
        title: r.title,
        style: r.styleType,
        colors: r.colorPalette
      })));
      // Log warning but continue - better to give user something than error out
      // The high temperature and penalties should prevent this most of the time
    } else {
      console.log(`✅ Good diversity score: ${diversity.score}/100`);
    }

    console.log(`✅ Generated ${analysis.outfitRecommendations.length} outfit recommendations via Groq`);
    console.log(`📊 Final Diversity score: ${diversity.score}/100`);

    return analysis;
  } catch (error) {
    console.error('❌ Groq API error:', error);
    throw new Error(
      error instanceof Error 
        ? `Groq AI failed: ${error.message}` 
        : 'Failed to generate recommendations with Groq'
    );
  }
}

/**
 * Build the prompt for Groq based on user inputs
 * Enhanced with personalization support
 */
function buildGroqPrompt(input: GroqRecommendationInput): string {
  const {
    occasion,
    genre,
    gender,
    weather,
    skinTone,
    dressColors,
    userPreferences,
    userBlocklists,
  } = input;

  // Base context
  let prompt = `
Generate 3 complete, diverse outfit recommendations for the following scenario:

**Occasion:** ${occasion}
**Style Genre:** ${genre || 'Any'}
**Gender:** ${gender || 'Unisex'}
${weather ? `**Weather:** ${weather}` : ''}
${skinTone ? `**Skin Tone:** ${skinTone}` : ''}`;

  // Add personalization if available
  if (userPreferences && userBlocklists) {
    const personalizationContext: PersonalizationContext = {
      preferences: userPreferences,
      blocklists: userBlocklists,
      currentContext: {
        occasion,
        weather,
        gender: gender || 'Unisex',
        uploadedColors: dressColors ? dressColors.split(',').map(c => c.trim()) : undefined,
        skinTone,
      },
    };

    const personalizedSections = buildPersonalizedPrompt(personalizationContext);
    
    prompt += '\n\n' + personalizedSections.preferencesSection;
    prompt += '\n' + personalizedSections.strategySection;
    prompt += '\n' + personalizedSections.constraintsSection;
    
    console.log('✅ [Groq] Personalization injected:', {
      favoriteColors: userPreferences.colors.favoriteColors.length,
      topStyles: userPreferences.styles.topStyles.length,
      confidence: userPreferences.overallConfidence,
    });
  }
  
  // Continue with rest of prompt (current colors and format instructions)
  prompt += `
${dressColors ? `**Current Outfit Colors:** ${dressColors}` : ''}

Your task: Create 3 RADICALLY DIFFERENT complete outfits. Each must be UNIQUE:

🎯 CRITICAL DIVERSITY MANDATE (NON-NEGOTIABLE):
❌ WRONG: Three navy suits with white shirts (TOO SIMILAR - REJECTED)
❌ WRONG: Three casual jeans outfits with different colored tops (NOT DIVERSE ENOUGH)
✅ CORRECT: One professional suit, one streetwear hoodie outfit, one bohemian layered look

- Outfit 1: One style direction (e.g., Minimalist Professional - monochrome, clean lines, tailored)
- Outfit 2: COMPLETELY DIFFERENT style (e.g., Bold Streetwear - bright colors, oversized, graphic prints)
- Outfit 3: YET ANOTHER DIFFERENT approach (e.g., Artistic Bohemian - earth tones, flowing fabrics, layered)

⚠️ STRICT REQUIREMENTS - EACH OUTFIT MUST HAVE:
- UNIQUE style type (casual/formal/streetwear/bohemian/minimalist/vintage/sporty/preppy/punk) - NO REPEATS!
- DISTINCT color scheme with ZERO shared colors between outfits if possible
  * Example: Outfit 1 (navy, white, grey) vs Outfit 2 (red, black, tan) vs Outfit 3 (olive, cream, burgundy)
- DIFFERENT silhouette & fit (slim-fit vs oversized vs relaxed vs athletic vs tailored)
- DIFFERENT vibe (professional vs edgy vs romantic vs sporty vs artistic vs rebellious)
- NO REPEATED clothing items across the 3 outfits - each outfit is COMPLETELY NEW
- DIFFERENT color palettes: vary ALL aspects (light/dark, warm/cool, neutral/bold, monochrome/colorful)
- DIFFERENT FORMALITY LEVELS (casual vs smart-casual vs business-casual vs formal)
- DIFFERENT TEXTURES & MATERIALS if possible (cotton vs wool vs denim vs leather vs linen)

Think of each outfit as designed for a DIFFERENT PERSON with a DIFFERENT personality.
DO NOT create variations of the same outfit - create 3 COMPLETELY DISTINCT looks.

JSON RESPONSE FORMAT:
{
  "outfitRecommendations": [
    {
      "title": "Concise outfit name",
      "description": "Why this outfit works (2-3 sentences)",
      "items": ["Item 1 with color+material", "Item 2", "Item 3", "Footwear", "Accessories"],
      "colorPalette": ["#HEX1", "#HEX2", "#HEX3"],
      "styleType": "casual|formal|streetwear|bohemian|minimalist|vintage|sporty",
      "occasion": "Specific occasion",
      "stylingTips": ["Tip 1", "Tip 2", "Tip 3"],
      "imagePrompt": "PROFESSIONAL FASHION CATALOG: Full-body shot, [detailed outfit description with fabrics, colors, textures]. White mannequin, centered, front-facing. Studio lighting at 45°. White seamless backdrop. High-res, 85mm lens, professional catalog quality.",
      "isExistingMatch": false
    }
  ],
  "styleAnalysis": {
    "currentStyle": "User's apparent style",
    "strengths": ["Strength 1", "Strength 2"],
    "improvements": ["Suggestion 1", "Suggestion 2"]
  },
  "seasonalAdvice": "Brief seasonal advice"
}

DIVERSITY EXAMPLES for "Business Casual":
✓ Outfit 1: "Smart Professional" - Navy blazer, white shirt, grey trousers, oxford shoes (classic)
✓ Outfit 2: "Creative Edge" - Black turtleneck, burgundy corduroys, chelsea boots (modern)
✓ Outfit 3: "Casual Friday" - Olive bomber, cream henley, dark jeans, white sneakers (relaxed)

✗ WRONG (too similar):
✗ Outfit 1: Navy blazer, white shirt, grey pants
✗ Outfit 2: Navy suit, white shirt, grey trousers
✗ Outfit 3: Navy jacket, white shirt, grey slacks
`;
  
  return prompt;
}

/**
 * Check if Groq API is configured
 */
export function isGroqConfigured(): boolean {
  const isConfigured = !!process.env.GROQ_API_KEY;
  if (!isConfigured) {
    console.warn('⚠️ GROQ_API_KEY not configured - Groq fallback unavailable');
  }
  return isConfigured;
}

/**
 * Validate that outfit recommendations are sufficiently diverse
 */
function validateDiversity(outfits: GroqOutfitRecommendation[]): { isValid: boolean; score: number; reason?: string } {
  if (outfits.length < 3) {
    return { isValid: true, score: 100 }; // Can't compare if less than 3
  }

  let diversityScore = 100;
  const reasons: string[] = [];

  // Check 1: All outfits have different style types
  const styleTypes = outfits.map(o => o.styleType?.toLowerCase() || '');
  const uniqueStyles = new Set(styleTypes);
  if (uniqueStyles.size < outfits.length) {
    diversityScore -= 30;
    reasons.push('Some outfits have same styleType');
  }

  // Check 2: Color palettes are different
  for (let i = 0; i < outfits.length; i++) {
    for (let j = i + 1; j < outfits.length; j++) {
      const colors1 = new Set(outfits[i].colorPalette?.map(c => c.toLowerCase()) || []);
      const colors2 = new Set(outfits[j].colorPalette?.map(c => c.toLowerCase()) || []);
      
      // Count overlapping colors
      const overlap = [...colors1].filter(c => colors2.has(c)).length;
      const totalUnique = colors1.size + colors2.size;
      const similarity = totalUnique > 0 ? (overlap / totalUnique) * 100 : 0;
      
      if (similarity > 60) { // More than 60% color overlap
        diversityScore -= 20;
        reasons.push(`Outfits ${i+1} and ${j+1} have ${similarity.toFixed(0)}% color overlap`);
      }
    }
  }

  // Check 3: Titles are different
  const titles = outfits.map(o => o.title.toLowerCase());
  const uniqueTitles = new Set(titles);
  if (uniqueTitles.size < outfits.length) {
    diversityScore -= 25;
    reasons.push('Some outfits have identical titles');
  }

  // Check 4: Items are different (at least some variation)
  for (let i = 0; i < outfits.length; i++) {
    for (let j = i + 1; j < outfits.length; j++) {
      const items1 = new Set(outfits[i].items?.map(item => item.toLowerCase().split(' ').slice(-1)[0]) || []);
      const items2 = new Set(outfits[j].items?.map(item => item.toLowerCase().split(' ').slice(-1)[0]) || []);
      
      const overlap = [...items1].filter(item => items2.has(item)).length;
      if (overlap > items1.size * 0.7) { // More than 70% item overlap
        diversityScore -= 15;
        reasons.push(`Outfits ${i+1} and ${j+1} have very similar items`);
      }
    }
  }

  const isValid = diversityScore >= 50; // Threshold for acceptable diversity
  const reason = reasons.length > 0 ? reasons.join('; ') : undefined;

  return { isValid, score: Math.max(0, diversityScore), reason };
}

/**
 * Test Groq connection
 */
export async function testGroqConnection(): Promise<boolean> {
  try {
    if (!isGroqConfigured()) {
      return false;
    }

    await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'llama-3.1-8b-instant', // Faster model for testing
      max_tokens: 10,
    });
    
    console.log('✅ Groq API connection successful');
    return true;
  } catch (error) {
    console.error('❌ Groq API connection failed:', error);
    return false;
  }
}
