/**
 * Groq API client for AI-powered fashion recommendations
 * Used as fallback when Gemini quota is exceeded
 */

import Groq from 'groq-sdk';

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
}

export interface GroqOutfitRecommendation {
  title: string;
  description: string;
  items: string[];
  colorPalette: string[];
  stylingTips: string[];
  imagePrompt: string;
  shoppingLinks?: {
    amazon?: string;
    flipkart?: string;
    myntra?: string;
  };
  isExistingMatch?: boolean;
}

export interface GroqStyleAnalysis {
  outfitRecommendations: GroqOutfitRecommendation[];
  styleAnalysis: {
    currentStyle: string;
    strengths: string[];
    improvements: string[];
  };
  seasonalAdvice: string;
}

/**
 * Generate fashion recommendations using Groq's Llama 3.1 70B model
 * This is a fallback when Gemini API quota is exceeded
 */
export async function generateRecommendationsWithGroq(
  input: GroqRecommendationInput
): Promise<GroqStyleAnalysis> {
  console.log('🤖 Using Groq AI for recommendations (Gemini fallback)...');

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

You provide detailed, actionable outfit recommendations that are practical, stylish, and appropriate for the user's needs. Always respond in valid JSON format.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile', // Updated: llama-3.1-70b-versatile was deprecated Oct 2025
      temperature: 0.7,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    
    console.log('✅ Groq response received');

    // Parse JSON response
    const analysis = JSON.parse(responseText) as GroqStyleAnalysis;

    // Validate response
    if (!analysis.outfitRecommendations || analysis.outfitRecommendations.length === 0) {
      throw new Error('Invalid response from Groq: no recommendations generated');
    }

    console.log(`✅ Generated ${analysis.outfitRecommendations.length} outfit recommendations via Groq`);

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
 */
function buildGroqPrompt(input: GroqRecommendationInput): string {
  const {
    occasion,
    genre,
    gender,
    weather,
    skinTone,
    dressColors,
  } = input;

  return `
Generate 3 complete, diverse outfit recommendations for the following scenario:

**Occasion:** ${occasion}
**Style Genre:** ${genre || 'Any'}
**Gender:** ${gender || 'Unisex'}
${weather ? `**Weather:** ${weather}` : ''}
${skinTone ? `**Skin Tone:** ${skinTone}` : ''}
${dressColors ? `**Current Outfit Colors:** ${dressColors}` : ''}

Please provide your response in the following JSON format:

{
  "outfitRecommendations": [
    {
      "title": "Brief outfit name (e.g., 'Smart Casual Elegance')",
      "description": "A 2-3 sentence description of this complete outfit and why it works for the occasion",
      "items": [
        "Specific clothing item 1 with color and material (e.g., 'Navy blue cotton blazer')",
        "Specific clothing item 2",
        "Specific clothing item 3",
        "Footwear",
        "Key accessories"
      ],
      "colorPalette": ["primary color", "secondary color", "accent color"],
      "stylingTips": [
        "Practical tip 1 on how to wear this outfit",
        "Practical tip 2",
        "Practical tip 3"
      ],
      "imagePrompt": "A detailed, photorealistic description for AI image generation: 'A high-resolution image of a mannequin wearing [describe the complete outfit in detail], set against a neutral studio background with soft lighting.'",
      "isExistingMatch": false
    }
  ],
  "styleAnalysis": {
    "currentStyle": "Brief description of the user's apparent style based on inputs",
    "strengths": ["Strength 1", "Strength 2"],
    "improvements": ["Suggestion 1", "Suggestion 2"]
  },
  "seasonalAdvice": "Brief seasonal styling advice based on weather and occasion"
}

**Requirements:**
1. Generate exactly 3 diverse outfit recommendations
2. Each outfit must be COMPLETE (top, bottom, shoes, accessories)
3. Consider weather conditions if provided
4. Respect the occasion (formal, casual, etc.)
5. Use complementary colors from the color palette
6. Make recommendations practical and achievable
7. Ensure outfits are culturally appropriate
8. Include specific brand-agnostic item descriptions
9. Provide actionable styling tips
10. Create detailed imagePrompt for AI image generation

Make the recommendations diverse in style while staying appropriate for the occasion.
`;
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
