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
  styleAnalysis: {
    currentStyle: string;
    strengths: string[];
    improvements: string[];
  };
  seasonalAdvice: string;
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

You provide detailed, actionable outfit recommendations that are practical, stylish, and appropriate for the user's needs. ${hasPersonalization ? 'You pay special attention to the user\'s established preferences, favorite colors, and past outfit choices to create highly personalized recommendations.' : ''} Always respond in valid JSON format.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile', // Updated: llama-3.1-70b-versatile was deprecated Oct 2025
      temperature: 0.7,
      max_tokens: 1500, // OPTIMIZED: Reduced from 2048 (sufficient for structured JSON)
      stream: true, // OPTIMIZED: Enable streaming for faster TTFB
      response_format: { type: 'json_object' },
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
      "styleType": "The fashion style category (e.g., casual, formal, streetwear, bohemian, minimalist, vintage, sporty)",
      "occasion": "Specific occasion where this outfit would be appropriate (e.g., office, date night, casual brunch, night out, business meeting)",
      "stylingTips": [
        "Practical tip 1 on how to wear this outfit",
        "Practical tip 2",
        "Practical tip 3"
      ],
      "imagePrompt": "PROFESSIONAL FASHION CATALOG PROMPT: Professional fashion catalog photography, full-body shot. [Describe complete outfit with EXACT fabric types, colors with hex codes, textures, and cut details]. Outfit displayed on WHITE MANNEQUIN in professional retail display (centered, front-facing). Include: specific accessories with materials/colors positioned on mannequin. Lighting: studio lighting with soft diffused key light from 45-degree angle creating subtle shadows for depth. Background: clean white seamless backdrop for professional catalog look. High resolution, sharp focus, professional quality, retail catalog aesthetic. Shot with 85mm lens, even lighting throughout, centered composition. [Specify mood: elegant and sophisticated / effortlessly chic / modern minimalist / etc.]",
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
