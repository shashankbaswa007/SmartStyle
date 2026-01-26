import { generateShoppingQuery } from '@/ai/flows/generate-shopping-query';
import type { StructuredAnalysis, ClothingItem } from '@/ai/flows/analyze-generated-image';
import { buildShoppingQueries, calculateColorMatchScore } from './shopping-query-builder';
import { logger } from './logger';

type TavilyResult = {
  amazon?: string | null;
  myntra?: string | null;
  tatacliq?: string | null;
};

// NEW: Enhanced shopping link result with per-item breakdown
interface ShoppingLinkResult {
  byItem: ItemShoppingLinks[];
  byPlatform: {
    amazon: ProductLink[];
    myntra: ProductLink[];
    tatacliq: ProductLink[];
  };
  metadata: {
    analyzedAt: string;
    itemsDetected: number;
    totalLinksFound: number;
    averageRelevanceScore: number;
  };
}

interface ItemShoppingLinks {
  itemNumber: number;
  itemName: string; // e.g., "Navy Blue Cotton Shirt"
  category: string;
  links: {
    amazon: ProductLink[];
    myntra: ProductLink[];
    tatacliq: ProductLink[];
  };
}

interface ProductLink {
  url: string;
  title: string;
  price?: string; // Extracted from title/content if available
  relevanceScore: number; // 0-1, how well it matches the item
  matchReasons: string[]; // ["color match", "exact type", "gender match"]
}

// In-memory cache for shopping searches (6-hour TTL)
const searchCache = new Map<string, { result: ShoppingLinkResult; expiresAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

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

// Helper to extract price from product title or content
function extractPrice(text: string): string | undefined {
  // Match Indian currency patterns: ₹1,234 or Rs.1234 or INR 1234
  const pricePatterns = [
    /₹\s*([0-9,]+(?:\.[0-9]{2})?)/,
    /Rs\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
    /INR\s*([0-9,]+(?:\.[0-9]{2})?)/i,
  ];
  
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      return `₹${match[1]}`;
    }
  }
  return undefined;
}

// NEW: Enhanced multi-level filtering for product relevance
function calculateProductRelevance(
  result: any,
  item: ClothingItem,
  queryUsed: string
): { score: number; reasons: string[] } {
  const text = `${result.title} ${result.content}`.toLowerCase();
  const reasons: string[] = [];
  let score = result.score || 0.5; // Start with Tavily's base score

  // Level 1: Item type matching (CRITICAL)
  const itemTypeVariants = [
    item.type.toLowerCase(),
    ...item.type.toLowerCase().split(/[\s-]+/), // Handle "t-shirt" -> ["t", "shirt"]
  ];
  const hasExactType = itemTypeVariants.some(variant => 
    text.includes(variant) || result.url.toLowerCase().includes(variant)
  );
  if (hasExactType) {
    score += 0.3;
    reasons.push('exact type match');
  } else {
    score -= 0.2; // Penalize wrong item type
  }

  // Level 2: Domain verification (ensure correct platform)
  const urlLower = result.url.toLowerCase();
  if (urlLower.includes('amazon.in') || urlLower.includes('myntra.com') || urlLower.includes('tatacliq.com')) {
    score += 0.1;
    reasons.push('trusted domain');
  }

  // Level 3: Color matching with fuzzy logic
  const colorScore = calculateColorMatchScore(item.color, text);
  if (colorScore > 0.7) {
    score += 0.25;
    reasons.push('strong color match');
  } else if (colorScore > 0.4) {
    score += 0.15;
    reasons.push('partial color match');
  }

  // Level 4: Gender indication
  const genderKeywords = item.gender === 'men' 
    ? ['men', 'male', 'mens', "men's"]
    : item.gender === 'women'
    ? ['women', 'female', 'womens', "women's", 'ladies']
    : [];
  
  if (genderKeywords.some(kw => text.includes(kw) || urlLower.includes(kw))) {
    score += 0.15;
    reasons.push('gender match');
  }

  // Level 5: Additional attributes (fabric, style, fit)
  let attributeMatches = 0;
  if (item.fabric && text.includes(item.fabric.toLowerCase())) {
    attributeMatches++;
    reasons.push(`fabric: ${item.fabric}`);
  }
  if (item.fit && text.includes(item.fit.toLowerCase())) {
    attributeMatches++;
    reasons.push(`fit: ${item.fit}`);
  }
  if (item.style && item.style.some(s => text.includes(s.toLowerCase()))) {
    attributeMatches++;
    reasons.push('style match');
  }
  if (item.pattern && text.includes(item.pattern.toLowerCase())) {
    attributeMatches++;
    reasons.push(`pattern: ${item.pattern}`);
  }
  
  score += attributeMatches * 0.1;

  // Level 6: Product page bonus (direct product links are better than category pages)
  if (urlLower.includes('/p/') || urlLower.includes('/product/') || urlLower.includes('/dp/')) {
    score += 0.2;
    reasons.push('direct product page');
  }

  // Normalize score to 0-1 range
  score = Math.max(0, Math.min(1, score));

  return { score, reasons };
}

// NEW: Search shopping links with structured item-by-item analysis
export async function searchShoppingLinksStructured(
  structuredAnalysis: StructuredAnalysis
): Promise<ShoppingLinkResult> {
  logger.log(`🛍️ [STRUCTURED SEARCH] Starting search for ${structuredAnalysis.items.length} items...`);

  // Check cache
  const cacheKey = JSON.stringify(structuredAnalysis.items.map(i => ({
    type: i.type,
    color: i.color,
    gender: i.gender,
  })));
  
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    logger.log('✅ Returning cached shopping links');
    return cached.result;
  }

  // Generate platform-specific queries for each item
  const platformQueries = buildShoppingQueries(structuredAnalysis);
  
  const byItem: ItemShoppingLinks[] = [];
  const byPlatform: ShoppingLinkResult['byPlatform'] = {
    amazon: [],
    myntra: [],
    tatacliq: [],
  };
  
  let totalLinksFound = 0;
  let totalRelevanceScore = 0;
  let relevanceCount = 0;

  // Search each item across all platforms
  for (let i = 0; i < structuredAnalysis.items.length; i++) {
    const item = structuredAnalysis.items[i];
    const amazonQuery = platformQueries.amazon[i];
    const myntraQuery = platformQueries.myntra[i];
    const cliqQuery = platformQueries.tatacliq[i];
    
    logger.log(`\n🔍 Item ${item.itemNumber}: ${item.type} (${item.color})`);
    
    const itemLinks: ItemShoppingLinks = {
      itemNumber: item.itemNumber,
      itemName: `${item.color} ${item.fabric || ''} ${item.type}`.trim(),
      category: item.category,
      links: {
        amazon: [],
        myntra: [],
        tatacliq: [],
      },
    };

    // Search Amazon
    try {
      const amazonResults = await searchSinglePlatform(
        amazonQuery,
        ['amazon.in'],
        item
      );
      itemLinks.links.amazon = amazonResults.slice(0, 2); // Top 2 results
      byPlatform.amazon.push(...amazonResults.slice(0, 2));
      totalLinksFound += amazonResults.length;
      amazonResults.forEach(r => {
        totalRelevanceScore += r.relevanceScore;
        relevanceCount++;
      });
      logger.log(`  Amazon: ${amazonResults.length} results`);
    } catch (err) {
      logger.error(`  Amazon search failed:`, (err as Error).message);
    }

    // Search Myntra
    try {
      const myntraResults = await searchSinglePlatform(
        myntraQuery,
        ['myntra.com'],
        item
      );
      itemLinks.links.myntra = myntraResults.slice(0, 2);
      byPlatform.myntra.push(...myntraResults.slice(0, 2));
      totalLinksFound += myntraResults.length;
      myntraResults.forEach(r => {
        totalRelevanceScore += r.relevanceScore;
        relevanceCount++;
      });
      logger.log(`  Myntra: ${myntraResults.length} results`);
    } catch (err) {
      logger.error(`  Myntra search failed:`, (err as Error).message);
    }

    // Search Tata CLiQ
    try {
      const cliqResults = await searchSinglePlatform(
        cliqQuery,
        ['tatacliq.com'],
        item
      );
      itemLinks.links.tatacliq = cliqResults.slice(0, 2);
      byPlatform.tatacliq.push(...cliqResults.slice(0, 2));
      totalLinksFound += cliqResults.length;
      cliqResults.forEach(r => {
        totalRelevanceScore += r.relevanceScore;
        relevanceCount++;
      });
      logger.log(`  Tata CLiQ: ${cliqResults.length} results`);
    } catch (err) {
      logger.error(`  Tata CLiQ search failed:`, (err as Error).message);
    }

    byItem.push(itemLinks);
  }

  const result: ShoppingLinkResult = {
    byItem,
    byPlatform,
    metadata: {
      analyzedAt: new Date().toISOString(),
      itemsDetected: structuredAnalysis.items.length,
      totalLinksFound,
      averageRelevanceScore: relevanceCount > 0 ? totalRelevanceScore / relevanceCount : 0,
    },
  };

  // Cache the result
  searchCache.set(cacheKey, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  logger.log(`\n✅ [STRUCTURED SEARCH] Complete: ${totalLinksFound} links, avg relevance: ${result.metadata.averageRelevanceScore.toFixed(2)}`);
  return result;
}

// Helper: Search a single platform for a single item
async function searchSinglePlatform(
  query: string,
  domains: string[],
  item: ClothingItem
): Promise<ProductLink[]> {
  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        include_domains: domains,
        max_results: 10,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Filter, score, and rank results
    const products: ProductLink[] = data.results
      .map((result: any) => {
        const relevance = calculateProductRelevance(result, item, query);
        return {
          url: result.url,
          title: result.title,
          price: extractPrice(`${result.title} ${result.content}`),
          relevanceScore: relevance.score,
          matchReasons: relevance.reasons,
        };
      })
      .filter((p: ProductLink) => p.relevanceScore > 0.3) // Minimum threshold
      .sort((a: ProductLink, b: ProductLink) => b.relevanceScore - a.relevanceScore);

    return products;
  } catch (err) {
    logger.error(`Platform search failed for ${domains[0]}:`, (err as Error).message);
    return [];
  }
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
  logger.log(`🔍 Searching platforms ${domains.join(', ')} with query: "${query}"`);

  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic', // Changed from 'advanced' for speed (2-3s faster)
        include_domains: domains,
        max_results: Math.min(maxResults, 15), // Limit for speed
        include_answer: false,
      }),
      signal: AbortSignal.timeout(5000), // Reduced from 10s to 5s
    });

    if (!response.ok) {
      logger.error(`[Tavily] API error: ${response.status}`);
      return { amazon: null, myntra: null, tatacliq: null };
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      logger.log(`[Tavily] No results found for query: "${query}"`);
      return { amazon: null, myntra: null, tatacliq: null };
    }

    logger.log(`✅ Tavily found ${data.results.length} results`);

    // Filter and rank results with SMART RELEVANCE SCORING
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
      .map((result: any) => {
        const text = `${result.title} ${result.content}`.toLowerCase();
        let relevanceScore = result.score || 0;
        
        // BOOST: Exact keyword matches in title (high relevance)
        priorityKeywords.forEach(keyword => {
          if (result.title.toLowerCase().includes(keyword.toLowerCase())) {
            relevanceScore += 0.3;
          }
        });
        
        // BOOST: Multiple keyword matches (comprehensive results)
        const matchCount = priorityKeywords.filter(kw => 
          text.includes(kw.toLowerCase())
        ).length;
        relevanceScore += (matchCount * 0.1);
        
        // BOOST: Product pages (more likely to be relevant)
        if (result.url.includes('/p/') || result.url.includes('/product/') || result.url.includes('/dp/')) {
          relevanceScore += 0.2;
        }
        
        // PENALTY: Generic category pages (less specific)
        if (result.url.includes('/shop/') || result.url.includes('/category/')) {
          relevanceScore -= 0.1;
        }
        
        return {
          title: result.title,
          url: result.url,
          content: result.content,
          score: relevanceScore,
        };
      })
      .sort((a: TavilySearchResult, b: TavilySearchResult) => b.score - a.score);

    logger.log(`   Filtered to ${filteredResults.length} relevant results`);

    return {
      amazon: extractLink(filteredResults, 'amazon'),
      myntra: extractLink(filteredResults, 'myntra'),
      tatacliq: extractLink(filteredResults, 'tatacliq'),
    };

  } catch (error) {
    logger.error('[Tavily] Search error:', error);
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
    logger.warn('⚠️ Tavily API key not configured; returning fallback search links.');
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

    logger.log('🤖 Generating smart query with Gemini...');
    let queryData;
    
    try {
      queryData = await generateShoppingQuery({
        clothingType: detectedClothingType,
        color: color,
        gender: gender || '',
        style: style,
        occasion: occasion,
      });
      logger.log('✅ Smart query generated:', queryData);
    } catch (error: any) {
      // Fallback to manual query generation if Gemini fails (quota exceeded, etc.)
      logger.warn('⚠️ Gemini query generation failed, using fallback:', error.message);
      
      const genderPrefix = gender?.toLowerCase() === 'female' ? 'women' : gender?.toLowerCase() === 'male' ? 'men' : '';
      const styleStr = style ? ` ${style}` : '';
      const occasionStr = occasion ? ` ${occasion}` : '';
      
      queryData = {
        primaryQuery: `${genderPrefix}${styleStr} ${color} ${detectedClothingType}${occasionStr}`.trim(),
        fallbackQueries: [
          `${color} ${detectedClothingType} for ${genderPrefix}`.trim(),
          `${genderPrefix} ${detectedClothingType} ${color}`.trim(),
        ],
        keywords: [detectedClothingType, color, genderPrefix, style, occasion].filter(Boolean),
        excludeTerms: ['pants', 'trousers', 'jeans', 'shorts', 'bottoms', 'joggers', 'leggings'],
        tataCliqQuery: `${genderPrefix} ${detectedClothingType}`.trim(),
      };
      
      logger.log('✅ Using fallback query:', queryData);
    }

    // Search Amazon and Myntra with primary query
    const amazonMyntraResults = await searchMultiplePlatforms(
      queryData.primaryQuery,
      ['amazon.in', 'myntra.com'],
      queryData.keywords.filter((k): k is string => k !== undefined),
      queryData.excludeTerms.filter((t): t is string => t !== undefined)
    );

    // Search TATA CLiQ with AI-optimized simple query first
    logger.log('[Tavily] TATA CLiQ using AI-optimized query:', queryData.tataCliqQuery);
    
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
      logger.log(`[Tavily] TATA CLiQ success with AI query!`);
    } else {
      // Fallback to even simpler queries
      logger.log('[Tavily] AI query failed, trying fallback CLiQ queries...');
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
          logger.log(`[Tavily] TATA CLiQ success with fallback: "${cliqQuery}"`);
          break;
        }
      }
    }

    // If still no CLiQ results, use direct search URL with AI query
    if (!cliqResult) {
      logger.log('[Tavily] No TATA CLiQ product found, using direct search URL');
      cliqResult = generateDirectSearchURL('tatacliq', queryData.tataCliqQuery, gender);
    }

    const result: TavilyResult = {
      amazon: amazonMyntraResults.amazon,
      myntra: amazonMyntraResults.myntra,
      tatacliq: cliqResult,
    };

    // If Amazon or Myntra missing, try fallback queries
    if (!result.amazon || !result.myntra) {
      logger.log('[Tavily] Some platforms missing, trying fallbacks...');
      for (const fallbackQuery of queryData.fallbackQueries) {
        const fallbackResults = await searchMultiplePlatforms(
          fallbackQuery,
          ['amazon.in', 'myntra.com'],
          queryData.keywords.filter((k): k is string => k !== undefined),
          queryData.excludeTerms.filter((t): t is string => t !== undefined)
        );
        
        if (!result.amazon) result.amazon = fallbackResults.amazon;
        if (!result.myntra) result.myntra = fallbackResults.myntra;
        
        if (result.amazon && result.myntra) break;
      }
    }

    // Generate direct search URLs for any still missing links
    if (!result.amazon) {
      result.amazon = generateDirectSearchURL('amazon', queryData.primaryQuery, gender);
      logger.log('⚠️ No Amazon link found, using direct search URL');
    }
    
    if (!result.myntra) {
      result.myntra = generateDirectSearchURL('myntra', queryData.primaryQuery, gender);
      logger.log('⚠️ No Myntra link found, using direct search URL');
    }

    logger.log('[Tavily] Final results:', result);
    return result;

  } catch (error) {
    logger.error('[Tavily] Smart search failed:', error);
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

// Export new types for structured shopping
export type {
  ShoppingLinkResult,
  ItemShoppingLinks,
  ProductLink,
};
