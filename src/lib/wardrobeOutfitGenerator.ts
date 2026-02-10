import Groq from 'groq-sdk';
import { WardrobeItemData } from './wardrobeService';
import { getComprehensivePreferences } from './preference-engine';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface OutfitCombination {
  name: string;
  items: {
    itemId: string;
    description: string;
    type: string;
  }[];
  reasoning: string;
  confidence: number;
  occasion: string;
}

export interface OutfitSuggestionResult {
  outfits: OutfitCombination[];
  wardrobeStats: {
    totalItems: number;
    itemsByType: Record<string, number>;
  };
  missingPieces?: string[];
}

/**
 * Generate outfit combinations from user's wardrobe using AI
 * @param wardrobeItems - Array of wardrobe items from client
 * @param userId - User ID for fetching preferences
 * @param occasion - Occasion for the outfit (casual, formal, party, etc.)
 * @param weather - Optional weather data
 * @returns AI-generated outfit combinations
 */
export async function generateWardrobeOutfits(
  wardrobeItems: WardrobeItemData[],
  userId: string,
  occasion: string,
  weather?: { temp: number; condition: string; location?: string }
): Promise<OutfitSuggestionResult> {
  console.log('👔 Generating wardrobe outfits - userId:', userId, '- occasion:', occasion, '- items:', wardrobeItems.length);

  try {
    // Filter only active items to exclude deleted/inactive items
    const activeItems = wardrobeItems.filter(item => item.isActive !== false);

    if (activeItems.length === 0) {
      throw new Error('No wardrobe items found. Please add items to your wardrobe first.');
    }
    
    // Provide guidance for sparse wardrobes
    if (activeItems.length < 3) {
      throw new Error('Not enough items in wardrobe. Please add at least 3 items to generate outfit suggestions.');
    }
    
    if (activeItems.length < 5) {
      console.warn('⚠️ Sparse wardrobe detected:', activeItems.length, 'items - generating best combinations with available items');
    }

    // Fetch user preferences
    const userPreferences = await getComprehensivePreferences(userId);

    // Organize items by type
    const itemsByType: Record<string, WardrobeItemData[]> = {
      top: [],
      bottom: [],
      dress: [],
      shoes: [],
      accessory: [],
      outerwear: [],
    };

    activeItems.forEach(item => {
      if (itemsByType[item.itemType]) {
        itemsByType[item.itemType].push(item);
      }
    });

    // Calculate stats
    const wardrobeStats = {
      totalItems: activeItems.length,
      itemsByType: {
        top: itemsByType.top.length,
        bottom: itemsByType.bottom.length,
        dress: itemsByType.dress.length,
        shoes: itemsByType.shoes.length,
        accessory: itemsByType.accessory.length,
        outerwear: itemsByType.outerwear.length,
      },
    };

    // Build AI prompt
    const prompt = buildOutfitPrompt(itemsByType, occasion, weather, userPreferences);

    console.log('🤖 Calling Groq AI for outfit suggestions...');

    // Call Groq AI
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a professional personal stylist. You help users create outfit combinations from their existing wardrobe. You provide practical, stylish suggestions that match their preferences and the occasion. Always respond in valid JSON format.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.8,
      max_tokens: 1500,
      stream: false,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';

    // Parse AI response
    const aiResponse = JSON.parse(responseText);

    if (!aiResponse.outfits || !Array.isArray(aiResponse.outfits)) {
      throw new Error('Invalid response from AI - no outfits generated');
    }

    // Validate that referenced items exist in wardrobe
    const validatedOutfits: OutfitCombination[] = [];

    for (const outfit of aiResponse.outfits) {
      const validatedItems: OutfitCombination['items'] = [];

      for (const itemRef of outfit.items || []) {
        // Try multiple matching strategies
        let wardrobeItem = null;
        
        // Strategy 1: Exact ID match
        if (itemRef.itemId) {
          wardrobeItem = wardrobeItems.find(item => item.id === itemRef.itemId);
        }
        
        // Strategy 2: Fuzzy description match
        if (!wardrobeItem && itemRef.description) {
          const searchTerms: string[] = itemRef.description.toLowerCase().split(' ');
          wardrobeItem = wardrobeItems.find(item => {
            const itemDesc = item.description.toLowerCase();
            // Item matches if description contains at least 2 search terms
            const matchCount = searchTerms.filter(term => 
              term.length > 2 && itemDesc.includes(term)
            ).length;
            return matchCount >= Math.min(2, searchTerms.length);
          });
        }
        
        // Strategy 3: Type and color match as fallback
        if (!wardrobeItem && itemRef.type) {
          wardrobeItem = wardrobeItems.find(item => 
            item.itemType === itemRef.type && 
            (!itemRef.description || item.description.includes(itemRef.description.split(' ')[0]))
          );
        }

        if (wardrobeItem) {
          // Avoid duplicate items in same outfit
          if (!validatedItems.some(vi => vi.itemId === wardrobeItem!.id)) {
            validatedItems.push({
              itemId: wardrobeItem.id!,
              description: wardrobeItem.description,
              type: wardrobeItem.itemType,
            });
          }
        } else {
          console.warn('Could not match AI-suggested item:', itemRef);
        }
      }

      // Only include outfits with at least 2 valid items
      if (validatedItems.length >= 2) {
        validatedOutfits.push({
          name: outfit.name || 'Outfit',
          items: validatedItems,
          reasoning: outfit.reasoning || 'This combination works well together.',
          confidence: Math.min(100, Math.max(0, outfit.confidence || 85)),
          occasion,
        });
      } else {
        console.warn('Skipping outfit with insufficient valid items:', outfit.name);
      }
    }

    if (validatedOutfits.length === 0) {
      throw new Error('Could not generate valid outfit combinations. Try adding more items to your wardrobe.');
    }

    console.log('✅ Generated', validatedOutfits.length, 'valid outfit combinations');

    return {
      outfits: validatedOutfits,
      wardrobeStats,
      missingPieces: aiResponse.missingPieces || [],
    };
  } catch (error) {
    console.error('❌ Error generating wardrobe outfits:', error);
    throw error;
  }
}

/**
 * Build the AI prompt for outfit generation
 */
function buildOutfitPrompt(
  itemsByType: Record<string, WardrobeItemData[]>,
  occasion: string,
  weather?: { temp: number; condition: string; description?: string; location?: string },
  userPreferences?: any
): string {
  let weatherInfo = '';
  let weatherGuidance = '';
  
  if (weather) {
    weatherInfo = `\n\nWEATHER FORECAST:
- Temperature: ${weather.temp}°C
- Condition: ${weather.condition}
- Description: ${weather.description || weather.condition}${weather.location ? `\n- Location: ${weather.location}` : ''}`;

    // Add weather-specific guidance
    if (weather.temp < 10) {
      weatherGuidance = '\n⚠️ COLD WEATHER: Prioritize warm layers, outerwear, scarves. Avoid lightweight fabrics.';
    } else if (weather.temp < 15) {
      weatherGuidance = '\n🧥 COOL WEATHER: Light jacket or cardigan recommended. Consider layering options.';
    } else if (weather.temp < 25) {
      weatherGuidance = '\n👔 MODERATE WEATHER: Versatile layering. Comfortable fabrics work well.';
    } else if (weather.temp < 30) {
      weatherGuidance = '\n☀️ WARM WEATHER: Light, breathable fabrics. Short sleeves appropriate.';
    } else {
      weatherGuidance = '\n🔥 HOT WEATHER: Minimal, breathable clothing essential. Light colors preferred.';
    }

    if (weather.condition.toLowerCase().includes('rain')) {
      weatherGuidance += '\n☔ RAINY CONDITIONS: Waterproof outerwear essential. Avoid delicate fabrics and suede.';
    } else if (weather.condition.toLowerCase().includes('snow')) {
      weatherGuidance += '\n❄️ SNOWY CONDITIONS: Waterproof boots and insulated outerwear required.';
    } else if (weather.condition.toLowerCase().includes('wind')) {
      weatherGuidance += '\n💨 WINDY CONDITIONS: Wind-resistant jacket recommended. Secure accessories.';
    }
  }

  const preferencesInfo = userPreferences
    ? `\n\nUSER PREFERENCES:
- Favorite Colors: ${userPreferences.colors?.favoriteColors?.slice(0, 5).map((c: any) => c.name).join(', ') || 'None'}
- Preferred Styles: ${userPreferences.styles?.preferredStyles?.slice(0, 3).map((s: any) => s.name).join(', ') || 'None'}
- Frequent Occasions: ${userPreferences.occasions?.preferredOccasions?.slice(0, 3).map((o: any) => o.occasion).join(', ') || 'None'}`
    : '';

  // Format wardrobe items for AI
  let wardrobeDescription = '';

  for (const [type, items] of Object.entries(itemsByType)) {
    if (items.length > 0) {
      wardrobeDescription += `\n\n${type.toUpperCase()}S (${items.length} items):`;
      items.forEach((item, idx) => {
        const colors = item.dominantColors?.slice(0, 3).join(', ') || 'unspecified colors';
        const brand = item.brand ? ` by ${item.brand}` : '';
        const worn = item.wornCount > 0 ? ` (worn ${item.wornCount}x)` : ' (never worn)';
        wardrobeDescription += `\n${idx + 1}. ${item.description}${brand} - ${colors}${worn} [ID: ${item.id}]`;
      });
    }
  }

  return `You are helping a user create outfit combinations from their existing wardrobe.

OCCASION: ${occasion}${weatherInfo}${weatherGuidance}${preferencesInfo}

USER'S WARDROBE:${wardrobeDescription}

TASK:
Create up to 3 DIFFERENT outfit combinations using ONLY items from the wardrobe above.

IMPORTANT RULES:
1. Work with WHATEVER item types are available - if the wardrobe only has tops and bottoms, create combinations with those
2. DO NOT infer or suggest items that don't exist in the wardrobe
3. Each outfit MUST use items that exist in the wardrobe (reference them by exact ID)
4. If certain item types (shoes, accessories, outerwear) are missing, ignore them - focus on the available items
5. Generate the best possible combinations with what's available

Each outfit must:
1. Be appropriate for the occasion: ${occasion}
2. ${weather ? `Be WEATHER-APPROPRIATE for ${weather.temp}°C and ${weather.condition} conditions` : 'Consider typical weather for this occasion'}
3. Include colors that work well together
4. Consider the user's preferences and wear history
5. Be practical and stylish${weather ? `\n6. IMPORTANT: All suggestions MUST be suitable for the forecasted weather conditions` : ''}

For each outfit, specify:
- name: A creative name for the outfit
- items: Array of items to wear (use exact item IDs from wardrobe)
- reasoning: Why this combination works, INCLUDING weather considerations if applicable (2-3 sentences)
- confidence: How confident you are in this suggestion (0-100)

Also suggest up to 3 "missing pieces" that would enhance the user's wardrobe for this occasion${weather ? ' and weather conditions' : ''}.

Respond in JSON format:
{
  "outfits": [
    {
      "name": "Classic Professional",
      "items": [
        {"itemId": "item_id_here", "description": "item description", "type": "top"},
        {"itemId": "item_id_here", "description": "item description", "type": "bottom"}
      ],
      "reasoning": "Explanation here",
      "confidence": 90
    }
  ],
  "missingPieces": ["Suggestion 1", "Suggestion 2"]
}`;
}

/**
 * Quick validation of outfit suggestion result
 */
export function validateOutfitResult(result: any): result is OutfitSuggestionResult {
  return (
    result &&
    Array.isArray(result.outfits) &&
    result.outfits.length > 0 &&
    result.outfits[0].items &&
    result.outfits[0].reasoning
  );
}
