import { generateShoppingQuery } from '@/ai/flows/generate-shopping-query';

type TavilyResult = {
  amazon?: string | null;
  myntra?: string | null;
  tatacliq?: string | null;
};

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

const TAVILY_API_URL = 'https://api.tavily.com/search';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

// Generate direct search URLs as fallback
function generateDirectSearchURL(platform: 'amazon' | 'myntra' | 'tatacliq', query: string, gender?: string): string {
  const encodedQuery = encodeURIComponent(query);
  
  switch (platform) {
    case 'amazon':
      return `https://www.amazon.in/s?k=${encodedQuery}&i=apparel`;
    case 'myntra':
      const genderPath = gender === 'male' ? 'men' : gender === 'female' ? 'women' : 'shop';
      return `https://www.myntra.com/${genderPath}?rawQuery=${encodedQuery}`;
    case 'tatacliq':
      // TATA CLiQ uses a specific query format: q=search:relevance
      // Example: q=t-shirts for men:relevance:inStockFlag:true
      const cleanQuery = query.replace(/\s+/g, ' ').trim();
      const searchQuery = `${cleanQuery}:relevance:inStockFlag:true`;
      const encodedCliqQuery = encodeURIComponent(searchQuery);
      return `https://www.tatacliq.com/search?q=${encodedCliqQuery}`;
    default:
      return '#';
  }
}

// TATA CLiQ-specific query optimizer
function optimizeForCliq(query: string, clothingType: string, gender: string): string[] {
  const queries: string[] = [];
  
  // Strategy 1: Just clothing type + gender (most likely to work)
  queries.push(`${gender} ${clothingType}`);
  
  // Strategy 2: Remove color modifiers, keep style
  const withoutColor = query
    .replace(/\b(blue|red|green|black|white|navy|grey|gray|brown|beige|pink|purple|yellow|orange)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (withoutColor && withoutColor !== query) {
    queries.push(withoutColor);
  }
  
  // Strategy 3: Just the clothing type (broadest)
  queries.push(clothingType);
  
  return [...new Set(queries)]; // Remove duplicates
}

// Helper to check if result contains upper-half clothing items
function extractUpperHalfItem(text: string): boolean {
  const upperHalfKeywords = [
    'shirt', 't-shirt', 'tshirt', 'tee', 'polo',
    'coat', 'jacket', 'blazer', 'cardigan',
    'top', 'blouse', 'sweater', 'hoodie',
    'sweatshirt', 'vest', 'waistcoat', 'pullover',
    'kurta', 'kurti', 'tunic', 'shrug', 'poncho',
    'crop top', 'tank top', 'camisole', 'halter'
  ];
  
  const lowerHalfKeywords = [
    'pant', 'pants', 'trouser', 'jean', 'jeans', 'short', 'shorts',
    'skirt', 'legging', 'leggings', 'jogger', 'joggers', 'track pant',
    'palazzo', 'culottes', 'cargo', 'chino', 'dhoti', 'salwar'
  ];
  
  const lowerText = text.toLowerCase();
  
  // Reject if contains lower-half keywords
  if (lowerHalfKeywords.some(keyword => lowerText.includes(keyword))) {
    return false;
  }
  
  // Accept if contains upper-half keywords
  return upperHalfKeywords.some(keyword => lowerText.includes(keyword));
}

// Helper to extract link by platform
function extractLink(results: TavilySearchResult[], platform: string): string | null {
  const result = results.find(r => r.url.includes(platform));
  return result?.url || null;
}

// Helper to check if we have enough valid results
function hasEnoughValidResults(results: TavilyResult): boolean {
  const validLinks = [results.amazon, results.myntra, results.tatacliq].filter(
    link => link && link !== '#' && !link.includes('fallback')
  );
  return validLinks.length >= 2; // At least 2 valid links
}

// Search multiple platforms with a specific query using Tavily API
async function searchMultiplePlatforms(
  query: string,
  domains: string[],
  priorityKeywords: string[],
  excludeTerms: string[],
  maxResults: number = 20
): Promise<TavilyResult> {
  console.log(`🔍 Searching platforms ${domains.join(', ')} with query: "${query}"`);

  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        include_domains: domains,
        max_results: maxResults,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[Tavily] API error: ${response.status}`);
      return { amazon: null, myntra: null, tatacliq: null };
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.log(`[Tavily] No results found for query: "${query}"`);
      return { amazon: null, myntra: null, tatacliq: null };
    }

    console.log(`✅ Tavily found ${data.results.length} results`);

    // Filter and rank results
    const filteredResults: TavilySearchResult[] = data.results
      .filter((result: any) => {
        const text = `${result.title} ${result.content}`.toLowerCase();
        
        // Exclude unwanted items
        if (excludeTerms.some(term => text.includes(term.toLowerCase()))) {
          return false;
        }

        // For TATA CLiQ, be very lenient - just check it's not lower-body clothing
        if (domains.includes('tatacliq.com')) {
          return extractUpperHalfItem(text);
        }

        // For other platforms, use keyword matching
        const hasKeywords = priorityKeywords.length === 0 || priorityKeywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        );

        return hasKeywords && extractUpperHalfItem(text);
      })
      .map((result: any) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score || 0,
      }))
      .sort((a: TavilySearchResult, b: TavilySearchResult) => b.score - a.score);

    console.log(`   Filtered to ${filteredResults.length} relevant results`);

    return {
      amazon: extractLink(filteredResults, 'amazon'),
      myntra: extractLink(filteredResults, 'myntra'),
      tatacliq: extractLink(filteredResults, 'tatacliq'),
    };

  } catch (error) {
    console.error('[Tavily] Search error:', error);
    return { amazon: null, myntra: null, tatacliq: null };
  }
}

// Smart search function using Gemini-generated queries
export async function tavilySearch(
  query: string, 
  colors: string[] = [], 
  gender?: string, 
  occasion?: string,
  style?: string,
  clothingType?: string
): Promise<TavilyResult> {
  if (!TAVILY_API_KEY) {
    console.warn('⚠️ Tavily API key not configured; returning fallback search links.');
    const fallbackQuery = `${gender || ''} ${clothingType || 'clothing'}`.trim();
    return {
      amazon: generateDirectSearchURL('amazon', fallbackQuery, gender),
      tatacliq: generateDirectSearchURL('tatacliq', fallbackQuery, gender),
      myntra: generateDirectSearchURL('myntra', fallbackQuery, gender),
    };
  }

  // Clean the query - remove any hex color codes
  const cleanQuery = query.replace(/#[0-9A-Fa-f]{6}/g, '').replace(/#[0-9A-Fa-f]{3}/g, '').trim();

  try {
    // Extract color from query or use first color from array
    const colorFromQuery = colors && colors.length > 0 ? colors[0] : '';
    const color = colorFromQuery || cleanQuery.split(' ').find(word => 
      /^(red|blue|green|black|white|navy|grey|gray|pink|purple|yellow|orange|brown|beige|cream)/i.test(word)
    ) || '';

    // Extract clothing type from query if not provided
    const detectedClothingType = clothingType || cleanQuery.split(' ').find(word => 
      /(shirt|jacket|blazer|top|sweater|coat|hoodie|cardigan|vest|blouse)/i.test(word)
    ) || cleanQuery.split(' ')[0];

    console.log('🤖 Generating smart query with Gemini...');
    const queryData = await generateShoppingQuery({
      clothingType: detectedClothingType,
      color: color,
      gender: gender || '',
      style: style,
      occasion: occasion,
    });

    console.log('✅ Smart query generated:', queryData);

    // Search Amazon and Myntra with primary query
    const amazonMyntraResults = await searchMultiplePlatforms(
      queryData.primaryQuery,
      ['amazon.in', 'myntra.com'],
      queryData.keywords,
      queryData.excludeTerms
    );

    // Search TATA CLiQ with AI-optimized simple query first
    console.log('[Tavily] TATA CLiQ using AI-optimized query:', queryData.tataCliqQuery);
    
    let cliqResult: string | null = null;
    
    // Try AI-generated TATA CLiQ query first
    const cliqResults = await searchMultiplePlatforms(
      queryData.tataCliqQuery,
      ['tatacliq.com'],
      [], // No keyword filtering for CLiQ - be lenient
      queryData.excludeTerms,
      10
    );
    
    if (cliqResults.tatacliq) {
      cliqResult = cliqResults.tatacliq;
      console.log(`[Tavily] TATA CLiQ success with AI query!`);
    } else {
      // Fallback to even simpler queries
      console.log('[Tavily] AI query failed, trying fallback CLiQ queries...');
      const cliqQueries = optimizeForCliq(queryData.primaryQuery, detectedClothingType, gender || '');
      
      for (const cliqQuery of cliqQueries) {
        const fallbackResults = await searchMultiplePlatforms(
          cliqQuery,
          ['tatacliq.com'],
          [],
          queryData.excludeTerms,
          10
        );
        
        if (fallbackResults.tatacliq) {
          cliqResult = fallbackResults.tatacliq;
          console.log(`[Tavily] TATA CLiQ success with fallback: "${cliqQuery}"`);
          break;
        }
      }
    }

    // If still no CLiQ results, use direct search URL with AI query
    if (!cliqResult) {
      console.log('[Tavily] No TATA CLiQ product found, using direct search URL');
      cliqResult = generateDirectSearchURL('tatacliq', queryData.tataCliqQuery, gender);
    }

    const result: TavilyResult = {
      amazon: amazonMyntraResults.amazon,
      myntra: amazonMyntraResults.myntra,
      tatacliq: cliqResult,
    };

    // If Amazon or Myntra missing, try fallback queries
    if (!result.amazon || !result.myntra) {
      console.log('[Tavily] Some platforms missing, trying fallbacks...');
      for (const fallbackQuery of queryData.fallbackQueries) {
        const fallbackResults = await searchMultiplePlatforms(
          fallbackQuery,
          ['amazon.in', 'myntra.com'],
          queryData.keywords,
          queryData.excludeTerms
        );
        
        if (!result.amazon) result.amazon = fallbackResults.amazon;
        if (!result.myntra) result.myntra = fallbackResults.myntra;
        
        if (result.amazon && result.myntra) break;
      }
    }

    // Generate direct search URLs for any still missing links
    if (!result.amazon) {
      result.amazon = generateDirectSearchURL('amazon', queryData.primaryQuery, gender);
      console.log('⚠️ No Amazon link found, using direct search URL');
    }
    
    if (!result.myntra) {
      result.myntra = generateDirectSearchURL('myntra', queryData.primaryQuery, gender);
      console.log('⚠️ No Myntra link found, using direct search URL');
    }

    console.log('[Tavily] Final results:', result);
    return result;

  } catch (error) {
    console.error('[Tavily] Smart search failed:', error);
    // Even in error case, return direct search URLs instead of null
    const fallbackQuery = `${gender || ''} ${clothingType || 'clothing'}`.trim();
    return {
      amazon: generateDirectSearchURL('amazon', fallbackQuery, gender),
      myntra: generateDirectSearchURL('myntra', fallbackQuery, gender),
      tatacliq: generateDirectSearchURL('tatacliq', fallbackQuery, gender),
    };
  }
}

export default tavilySearch;
