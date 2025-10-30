import { ai } from '../genkit';
import { z } from 'zod';

const ShoppingQuerySchema = z.object({
  primaryQuery: z.string().describe('Main search query optimized for e-commerce'),
  fallbackQueries: z.array(z.string()).describe('Alternative search queries if primary fails'),
  keywords: z.array(z.string()).describe('Key search terms to prioritize'),
  excludeTerms: z.array(z.string()).describe('Terms to exclude from results'),
  tataCliqQuery: z.string().describe('Simplified query specifically optimized for TATA CLiQ search (very simple, 2-4 words max)'),
});

export const generateShoppingQuery = ai.defineFlow(
  {
    name: 'generateShoppingQuery',
    inputSchema: z.object({
      clothingType: z.string(),
      color: z.string(),
      style: z.string().optional(),
      gender: z.string(),
      occasion: z.string().optional(),
      brand: z.string().optional(),
      priceRange: z.string().optional(),
    }),
    outputSchema: ShoppingQuerySchema,
  },
  async (input) => {
    const prompt = `You are an expert e-commerce search query optimizer for fashion shopping.

Given the following outfit details:
- Clothing Type: ${input.clothingType}
- Color: ${input.color}
- Gender: ${input.gender}
${input.style ? `- Style: ${input.style}` : ''}
${input.occasion ? `- Occasion: ${input.occasion}` : ''}
${input.brand ? `- Brand Preference: ${input.brand}` : ''}
${input.priceRange ? `- Price Range: ${input.priceRange}` : ''}

Generate optimized search queries for Amazon Fashion, Myntra, and TATA CLiQ that will return the most relevant upper-body clothing items (shirts, t-shirts, jackets, blazers, tops, coats).

**IMPORTANT for TATA CLiQ:**
TATA CLiQ requires very simple, broad queries (2-4 words max). They prefer generic terms over specific modifiers.
Good TATA CLiQ queries: "men shirt", "women blazer", "casual jacket"
Bad TATA CLiQ queries: "navy blue formal cotton blazer for men"

Requirements:
1. Primary query should be concise yet specific (5-8 words max) - for Amazon/Myntra
2. Include color, clothing type, and gender
3. Use terms that match how products are listed on e-commerce sites
4. Prioritize upper-half clothing items only
5. Include 2-3 fallback queries with alternative phrasings
6. List important keywords to prioritize in results
7. List terms to exclude (lower-body items like pants, jeans, shorts)
8. **tataCliqQuery: Create a separate, VERY SIMPLE query for TATA CLiQ (2-4 words: gender + clothing type, optionally + style/color)**

Example:
For "Blue formal blazer for men":
- Primary: "mens blue formal blazer jacket"
- Fallback: ["blue suit jacket men", "navy blazer formal menswear"]
- Keywords: ["blazer", "jacket", "formal", "blue", "mens"]
- Exclude: ["pants", "trousers", "jeans", "shorts", "bottoms"]
- tataCliqQuery: "men blazer" (SIMPLE!)

Return the optimized search queries.`;

    const { output } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt,
      output: {
        schema: ShoppingQuerySchema,
      },
    });

    return output!;
  }
);
