import { GoogleGenerativeAI } from '@google/generative-ai';

// Use GOOGLE_GENAI_API_KEY to match the rest of the codebase
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);

export interface GeneratedImageAnalysis {
  dominantColors: Array<{
    name: string;
    hex: string;
    percentage: number;
  }>;
  shoppingQuery: string;
  detailedDescription: string;
}

/**
 * Analyzes a generated outfit image to extract accurate color palette and create shopping query
 * Uses Gemini 2.0 Flash (primary) with 1.5 Pro fallback for best performance and accuracy
 */
export async function analyzeGeneratedImage(
  imageUrl: string,
  outfitTitle: string,
  outfitDescription: string,
  outfitItems: string[],
  gender: string
): Promise<GeneratedImageAnalysis> {
  console.log('🔍 Analyzing generated image for accurate colors and shopping query...');

  const prompt = `You are an expert fashion color analyst and e-commerce search specialist with deep knowledge of Indian fashion terminology and color theory.

Analyze this outfit image with EXTREME PRECISION and provide:

1. **DOMINANT COLORS ANALYSIS** (CRITICAL - Extract from the ACTUAL IMAGE):
   - Identify the 3-5 most dominant colors you SEE in the outfit
   - Use fashion-specific color names (e.g., "Midnight Navy", "Champagne Gold", "Dusty Rose", "Emerald Green")
   - Provide ACCURATE hex codes that match the colors in the image
   - Estimate the percentage each color occupies in the outfit
   - Order by prominence (most dominant first)
   - IMPORTANT: Analyze the ACTUAL image, not the description

2. **OPTIMIZED SHOPPING QUERY** (Create the PERFECT search for Indian e-commerce):
   Context provided:
   - Title: "${outfitTitle}"
   - Description: "${outfitDescription}"
   - Gender: "${gender}"
   - Item types: ${outfitItems.join(', ')}
   
   Create a search query that is HIGHLY OPTIMIZED for e-commerce product searches:
   
   **STRUCTURE YOUR QUERY EXACTLY LIKE THIS:**
   [Gender] [Primary Item Type] [Dominant Color] [Secondary Details] [Fabric/Pattern] [Occasion]
   
   **EXAMPLES OF PERFECT QUERIES:**
   - "women blue silk kurta set with embroidery festive wear"
   - "men black cotton casual shirt long sleeve"
   - "women red georgette saree with golden border wedding"
   - "men navy blue slim fit blazer formal office wear"
   - "women white chiffon dress floral print party wear"
   
   **CRITICAL RULES:**
   ✓ Start with gender (male/female/women/men)
   ✓ Use the PRIMARY clothing item next (shirt, kurta, saree, dress, blazer, etc.)
   ✓ Include the MAIN color from your analysis
   ✓ Add fabric type if visible (silk, cotton, chiffon, georgette, velvet, linen)
   ✓ Add pattern if visible (printed, embroidered, plain, striped, floral)
   ✓ End with occasion/style (wedding, festive, casual, formal, party, office)
   ✓ Keep it 8-12 words maximum - BE CONCISE but SPECIFIC
   ✓ Use terms that appear in product titles on Myntra, TATA CLiQ, and Amazon India
   ✓ NO generic terms like "outfit" or "ensemble" - use SPECIFIC item names
   ✓ Focus on the UPPER HALF clothing item (shirt, kurta, top, blouse, blazer, jacket)
   
   Make it PERFECTLY OPTIMIZED for product search algorithms on Indian e-commerce platforms.

3. **DETAILED VISUAL DESCRIPTION** (2-3 sentences):
   - Describe EXACTLY what you see in the image
   - Mention specific colors, fabrics, patterns, textures, or embellishments visible
   - Note the styling, silhouette, and overall aesthetic
   - Specify the occasion/vibe this outfit is suitable for

RESPONSE FORMAT (JSON only, no markdown):
{
  "dominantColors": [
    { "name": "Midnight Navy", "hex": "#191970", "percentage": 45 },
    { "name": "Ivory White", "hex": "#fffff0", "percentage": 30 },
    { "name": "Champagne Gold", "hex": "#f7e7ce", "percentage": 15 },
    { "name": "Dusty Rose", "hex": "#dcae96", "percentage": 10 }
  ],
  "shoppingQuery": "women navy silk kurta embroidered festive wear",
  "detailedDescription": "This elegant ensemble features a rich midnight navy silk kurta with intricate champagne gold embroidery along the neckline and sleeves, paired with an ivory dupatta. The luxurious fabric combination and detailed embellishment work create a sophisticated look perfect for weddings and festive celebrations."
}

CRITICAL REQUIREMENTS:
✓ Extract colors FROM THE IMAGE using your vision capabilities
✓ Use precise hex codes that accurately match what you see
✓ The shopping query MUST be concise (8-12 words), specific, and optimized for product search
✓ Focus on the PRIMARY upper-half clothing item in the query
✓ Use search terms that match actual product titles on e-commerce sites
✓ Include ALL relevant details: gender, colors, items, fabric, pattern, style, occasion
✓ Use Indian fashion terminology (kurta, dupatta, saree, lehenga, anarkali, etc.)
✓ Make sure the description reflects what is ACTUALLY VISIBLE in the image`;

  // Fetch the image once
  let base64Image: string;
  try {
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    base64Image = Buffer.from(imageBuffer).toString('base64');
  } catch (error) {
    console.error('❌ Failed to fetch image:', error);
    throw error;
  }

  // Try Gemini 2.0 Flash first (primary model)
  try {
    console.log('🚀 Attempting analysis with Gemini 2.0 Flash (primary model)...');
    
    const flashModel = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.4, // Lower temperature for more accurate color analysis
        topP: 0.8,
        topK: 40,
      }
    });

    const flashResult = await flashModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
    ]);

    const responseText = flashResult.response.text();
    console.log('📊 Gemini 2.0 Flash analysis response:', responseText.substring(0, 200) + '...');

    // Extract JSON from the response (handle markdown code blocks)
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    // If wrapped in markdown code blocks, extract from there
    if (!jsonMatch) {
      const codeBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonMatch = codeBlockMatch[1].match(/\{[\s\S]*\}/);
      }
    }
    
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Gemini 2.0 Flash response');
    }

    const analysis: GeneratedImageAnalysis = JSON.parse(jsonMatch[0]);

    // Validate the response
    if (!analysis.dominantColors || analysis.dominantColors.length === 0) {
      throw new Error('No colors extracted from image by Gemini 2.0 Flash');
    }

    console.log('✅ Gemini 2.0 Flash analysis successful:', {
      colorsFound: analysis.dominantColors.length,
      colors: analysis.dominantColors.map(c => `${c.name} (${c.hex})`).join(', '),
      query: analysis.shoppingQuery,
    });

    return analysis;

  } catch (flash2Error) {
    console.warn('⚠️ Gemini 2.0 Flash failed, falling back to Gemini 1.5 Flash:', flash2Error);

    // Fallback to Gemini 1.5 Flash (more stable than 1.5 Pro)
    try {
      console.log('🔄 Attempting analysis with Gemini 1.5 Flash (fallback model)...');
      
      const flashModel = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.4,
          topP: 0.8,
          topK: 40,
        }
      });

      const flashResult = await flashModel.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
      ]);

      const responseText = flashResult.response.text();
      console.log('📊 Gemini 1.5 Flash analysis response:', responseText.substring(0, 200) + '...');

      // Extract JSON from the response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        const codeBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonMatch = codeBlockMatch[1].match(/\{[\s\S]*\}/);
        }
      }
      
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from Gemini 1.5 Flash response');
      }

      const analysis: GeneratedImageAnalysis = JSON.parse(jsonMatch[0]);

      // Validate the response
      if (!analysis.dominantColors || analysis.dominantColors.length === 0) {
        throw new Error('No colors extracted from image by Gemini 1.5 Flash');
      }

      console.log('✅ Gemini 1.5 Flash analysis successful (fallback):', {
        colorsFound: analysis.dominantColors.length,
        colors: analysis.dominantColors.map(c => `${c.name} (${c.hex})`).join(', '),
        query: analysis.shoppingQuery,
      });

      return analysis;

    } catch (flashError) {
      console.error('❌ Both Gemini 2.0 Flash and 1.5 Flash failed:', {
        flash2Error,
        flashError,
      });
      
      // Final fallback: create a basic query from the provided data
      const fallbackQuery = `${gender} ${outfitItems.join(' ')} ${outfitTitle} buy online India fashion`;
      
      console.log('⚠️ Using fallback query (no AI analysis):', fallbackQuery);
      
      return {
        dominantColors: [],
        shoppingQuery: fallbackQuery,
        detailedDescription: outfitDescription,
      };
    }
  }
}
