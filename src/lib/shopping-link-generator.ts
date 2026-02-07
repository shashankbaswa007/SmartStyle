/**
 * Pattern-Based Shopping Link Generator
 * 
 * Generates shopping links instantly using predictable URL patterns
 * from Amazon India, Myntra, and Tata CLiQ without external API calls.
 * 
 * Performance: < 5ms for 18 URLs (3 outfits × 2 items × 3 platforms)
 * Reliability: 100% (no external dependencies)
 * Cost: $0 (no API consumption)
 */

// ============================================================================
// COLOR HEX TO NAME MAPPING
// ============================================================================

interface ColorMapping {
  hex: string;
  name: string;
  searchTerms: string[]; // Alternative search terms
}

const COLOR_LOOKUP: ColorMapping[] = [
  // Blues family
  { hex: '#000080', name: 'navy blue', searchTerms: ['navy', 'dark blue'] },
  { hex: '#0000FF', name: 'blue', searchTerms: ['bright blue', 'royal blue'] },
  { hex: '#87CEEB', name: 'sky blue', searchTerms: ['light blue', 'baby blue'] },
  { hex: '#4169E1', name: 'royal blue', searchTerms: ['blue', 'cobalt'] },
  { hex: '#1E3A8A', name: 'navy blue', searchTerms: ['dark blue', 'midnight blue'] },
  { hex: '#3B82F6', name: 'blue', searchTerms: ['bright blue'] },
  { hex: '#60A5FA', name: 'light blue', searchTerms: ['sky blue'] },
  { hex: '#1E40AF', name: 'dark blue', searchTerms: ['navy blue'] },
  { hex: '#00CED1', name: 'turquoise', searchTerms: ['cyan', 'aqua blue'] },
  { hex: '#5F9EA0', name: 'teal blue', searchTerms: ['teal', 'ocean blue'] },
  
  // Reds family
  { hex: '#FF0000', name: 'red', searchTerms: ['bright red', 'crimson'] },
  { hex: '#DC143C', name: 'crimson', searchTerms: ['deep red', 'dark red'] },
  { hex: '#8B0000', name: 'dark red', searchTerms: ['maroon', 'wine red'] },
  { hex: '#FFC0CB', name: 'pink', searchTerms: ['light pink', 'baby pink'] },
  { hex: '#FF1493', name: 'hot pink', searchTerms: ['bright pink', 'magenta'] },
  { hex: '#EF4444', name: 'red', searchTerms: ['bright red'] },
  { hex: '#B91C1C', name: 'dark red', searchTerms: ['maroon'] },
  { hex: '#FCA5A5', name: 'light pink', searchTerms: ['pink', 'rose'] },
  { hex: '#FF69B4', name: 'pink', searchTerms: ['hot pink'] },
  { hex: '#FFB6C1', name: 'light pink', searchTerms: ['pink', 'blush'] },
  { hex: '#C71585', name: 'magenta', searchTerms: ['bright pink', 'fuchsia'] },
  
  // Greens family
  { hex: '#008000', name: 'green', searchTerms: ['forest green', 'dark green'] },
  { hex: '#90EE90', name: 'light green', searchTerms: ['mint green', 'pastel green'] },
  { hex: '#556B2F', name: 'olive green', searchTerms: ['khaki green', 'army green'] },
  { hex: '#50C878', name: 'emerald green', searchTerms: ['bright green', 'jade green'] },
  { hex: '#10B981', name: 'green', searchTerms: ['mint green', 'sea green'] },
  { hex: '#22C55E', name: 'green', searchTerms: ['bright green'] },
  { hex: '#16A34A', name: 'green', searchTerms: ['forest green'] },
  { hex: '#14532D', name: 'dark green', searchTerms: ['forest green', 'hunter green'] },
  { hex: '#00FF00', name: 'lime green', searchTerms: ['neon green', 'bright green'] },
  { hex: '#32CD32', name: 'lime green', searchTerms: ['bright green'] },
  { hex: '#98FB98', name: 'mint green', searchTerms: ['light green', 'pastel green'] },
  
  // Yellows and Oranges family
  { hex: '#FFFF00', name: 'yellow', searchTerms: ['bright yellow', 'lemon yellow'] },
  { hex: '#FFD700', name: 'golden yellow', searchTerms: ['gold', 'mustard'] },
  { hex: '#FFA500', name: 'orange', searchTerms: ['bright orange'] },
  { hex: '#FF8C00', name: 'dark orange', searchTerms: ['burnt orange'] },
  { hex: '#F97316', name: 'orange', searchTerms: ['burnt orange', 'rust'] },
  { hex: '#FB923C', name: 'orange', searchTerms: ['light orange', 'peach'] },
  { hex: '#FBBF24', name: 'yellow', searchTerms: ['golden yellow'] },
  { hex: '#FCD34D', name: 'yellow', searchTerms: ['light yellow'] },
  { hex: '#FDE047', name: 'bright yellow', searchTerms: ['yellow'] },
  { hex: '#FBBF24', name: 'amber', searchTerms: ['golden yellow', 'mustard'] },
  { hex: '#FF6347', name: 'tomato', searchTerms: ['coral', 'red orange'] },
  { hex: '#FF7F50', name: 'coral', searchTerms: ['peach', 'salmon'] },
  
  // Purples family
  { hex: '#800080', name: 'purple', searchTerms: ['violet', 'dark purple'] },
  { hex: '#9370DB', name: 'lavender', searchTerms: ['light purple', 'lilac'] },
  { hex: '#8B008B', name: 'dark purple', searchTerms: ['plum', 'eggplant'] },
  { hex: '#DDA0DD', name: 'plum', searchTerms: ['light purple', 'mauve'] },
  { hex: '#A855F7', name: 'purple', searchTerms: ['violet'] },
  { hex: '#9333EA', name: 'purple', searchTerms: ['bright purple'] },
  { hex: '#7C3AED', name: 'purple', searchTerms: ['violet'] },
  { hex: '#6B21A8', name: 'dark purple', searchTerms: ['deep purple'] },
  { hex: '#E0BBE4', name: 'lavender', searchTerms: ['light purple'] },
  
  // Neutrals family
  { hex: '#000000', name: 'black', searchTerms: ['dark'] },
  { hex: '#FFFFFF', name: 'white', searchTerms: ['off white'] },
  { hex: '#C0C0C0', name: 'silver', searchTerms: ['light grey', 'metallic grey'] },
  { hex: '#808080', name: 'grey', searchTerms: ['gray', 'neutral grey'] },
  { hex: '#A9A9A9', name: 'light grey', searchTerms: ['silver', 'ash grey'] },
  { hex: '#696969', name: 'grey', searchTerms: ['dark grey', 'charcoal grey'] },
  { hex: '#2F4F4F', name: 'charcoal', searchTerms: ['dark grey', 'slate grey'] },
  { hex: '#D3D3D3', name: 'light grey', searchTerms: ['silver grey', 'ash'] },
  { hex: '#708090', name: 'slate grey', searchTerms: ['grey', 'steel grey'] },
  { hex: '#778899', name: 'grey', searchTerms: ['slate grey'] },
  
  // Browns family
  { hex: '#8B4513', name: 'brown', searchTerms: ['saddle brown', 'chocolate'] },
  { hex: '#A52A2A', name: 'brown', searchTerms: ['dark brown'] },
  { hex: '#D2691E', name: 'brown', searchTerms: ['chocolate brown', 'tan'] },
  { hex: '#CD853F', name: 'tan', searchTerms: ['beige brown', 'camel'] },
  { hex: '#F4A460', name: 'tan', searchTerms: ['sandy brown', 'camel'] },
  { hex: '#DEB887', name: 'beige', searchTerms: ['tan', 'khaki'] },
  { hex: '#BC8F8F', name: 'brown', searchTerms: ['rosy brown', 'dusty rose'] },
  
  // Beige/Cream family
  { hex: '#F5F5DC', name: 'beige', searchTerms: ['cream', 'ivory'] },
  { hex: '#FFFFF0', name: 'cream', searchTerms: ['ivory', 'off white'] },
  { hex: '#FAEBD7', name: 'cream', searchTerms: ['antique white', 'beige'] },
  { hex: '#FFE4C4', name: 'cream', searchTerms: ['bisque', 'peach cream'] },
  { hex: '#FFDEAD', name: 'beige', searchTerms: ['navajo white', 'tan'] },
  { hex: '#F5DEB3', name: 'beige', searchTerms: ['wheat', 'tan'] },
  
  // Additional Fashion Colors
  { hex: '#FF00FF', name: 'magenta', searchTerms: ['fuchsia', 'bright pink'] },
  { hex: '#00FFFF', name: 'cyan', searchTerms: ['aqua', 'bright blue'] },
  { hex: '#4B0082', name: 'indigo', searchTerms: ['dark blue purple', 'navy purple'] },
  { hex: '#FFE4E1', name: 'blush', searchTerms: ['misty rose', 'light pink'] },
  { hex: '#E6E6FA', name: 'lavender', searchTerms: ['light purple', 'lilac'] },
  { hex: '#FFFACD', name: 'lemon', searchTerms: ['light yellow', 'cream yellow'] },
  { hex: '#7FFF00', name: 'chartreuse', searchTerms: ['lime green', 'yellow green'] },
  { hex: '#800000', name: 'maroon', searchTerms: ['burgundy', 'wine red'] },
  { hex: '#FA8072', name: 'salmon', searchTerms: ['coral pink', 'peach'] },
  { hex: '#E0E0E0', name: 'light grey', searchTerms: ['platinum', 'silver'] },
];

/**
 * Convert hex color code to searchable color name
 * Uses Euclidean distance in RGB space for closest match
 */
function hexToColorName(hexCode: string): string {
  // Normalize hex code
  const hex = hexCode.toUpperCase().replace('#', '');
  
  // Try exact match first
  const exactMatch = COLOR_LOOKUP.find(c => c.hex.toUpperCase().replace('#', '') === hex);
  if (exactMatch) {
    return exactMatch.name;
  }
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Find closest color using Euclidean distance
  let minDistance = Infinity;
  let closestColor = 'multicolor';
  
  for (const color of COLOR_LOOKUP) {
    const colorHex = color.hex.replace('#', '');
    const cr = parseInt(colorHex.substring(0, 2), 16);
    const cg = parseInt(colorHex.substring(2, 4), 16);
    const cb = parseInt(colorHex.substring(4, 6), 16);
    
    const distance = Math.sqrt(
      Math.pow(r - cr, 2) + 
      Math.pow(g - cg, 2) + 
      Math.pow(b - cb, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color.name;
    }
  }
  
  return closestColor;
}

// ============================================================================
// QUERY CONSTRUCTION
// ============================================================================

interface OutfitData {
  gender: string;
  items: string[];
  colorPalette: string[];
  style: string;
  description?: string;
}

/**
 * Extract fabric keywords from outfit description
 */
function extractFabric(description?: string): string | null {
  if (!description) return null;
  
  const fabricKeywords = [
    'cotton', 'linen', 'silk', 'denim', 'wool', 
    'polyester', 'rayon', 'chiffon', 'velvet', 
    'satin', 'leather', 'suede', 'khaki'
  ];
  
  const lowerDesc = description.toLowerCase();
  for (const fabric of fabricKeywords) {
    if (lowerDesc.includes(fabric)) {
      return fabric;
    }
  }
  
  return null;
}

/**
 * Extract style descriptors from style field
 */
function extractStyleKeywords(style: string): string[] {
  const keywords: string[] = [];
  const lowerStyle = style.toLowerCase();
  
  // Map of style categories
  const styleMap: { [key: string]: string } = {
    'casual': 'casual',
    'formal': 'formal',
    'business': 'formal',
    'ethnic': 'ethnic',
    'traditional': 'ethnic',
    'western': 'western',
    'party': 'party',
    'festive': 'festive',
    'sports': 'sports',
    'athletic': 'sports',
  };
  
  for (const [keyword, mapped] of Object.entries(styleMap)) {
    if (lowerStyle.includes(keyword) && !keywords.includes(mapped)) {
      keywords.push(mapped);
    }
  }
  
  return keywords.slice(0, 1); // Return max 1 style keyword
}

/**
 * Build optimized search query for a specific item
 */
function buildSearchQuery(
  outfit: OutfitData,
  itemType: string,
  platform: 'amazon' | 'myntra' | 'tatacliq'
): string {
  const parts: string[] = [];
  
  // Get primary color (first in palette)
  const primaryColor = outfit.colorPalette[0] 
    ? hexToColorName(outfit.colorPalette[0])
    : '';
  
  // Extract fabric
  const fabric = extractFabric(outfit.description);
  
  // Extract style keywords
  const styleKeywords = extractStyleKeywords(outfit.style);
  
  // Build query based on platform
  if (platform === 'amazon') {
    // Amazon: Simple query with just gender + color + item
    const gender = outfit.gender.toLowerCase().includes('women') 
      ? 'women' 
      : outfit.gender.toLowerCase().includes('men') 
        ? 'men' 
        : '';
    
    if (gender) parts.push(gender);
    if (primaryColor && primaryColor !== 'multicolor') parts.push(primaryColor);
    parts.push(itemType);
    
  } else if (platform === 'myntra') {
    // Myntra: Simple query with just color + item (gender in URL)
    if (primaryColor && primaryColor !== 'multicolor') parts.push(primaryColor);
    parts.push(itemType);
    
  } else if (platform === 'tatacliq') {
    // Tata CLiQ: Simple query with just color + item
    if (primaryColor && primaryColor !== 'multicolor') parts.push(primaryColor);
    parts.push(itemType);
  }
  
  // Clean and validate
  let query = parts.join(' ').trim();
  
  // Remove duplicate words
  const words = query.split(' ');
  const uniqueWords = [...new Set(words)];
  query = uniqueWords.join(' ');
  
  // Ensure we have at least the item type
  if (uniqueWords.length < 1) {
    query = itemType;
  }
  
  // Limit to 3 words maximum for best e-commerce results
  const finalWords = query.split(' ').slice(0, 3);
  
  return finalWords.join(' ');
}

// ============================================================================
// PLATFORM-SPECIFIC URL BUILDERS
// ============================================================================

/**
 * Build Amazon India search URL
 */
function buildAmazonURL(query: string, gender: string): string {
  const baseUrl = 'https://www.amazon.in/s';
  
  // Clean and encode query (spaces become plus signs)
  const cleanQuery = query.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const encodedQuery = cleanQuery.replace(/\s+/g, '+');
  
  // Determine category based on gender
  let categoryId = '1968122031'; // Default: General Clothing & Accessories
  const lowerGender = gender.toLowerCase();
  
  if (lowerGender.includes('men') && !lowerGender.includes('women')) {
    categoryId = '1968093031'; // Men's Clothing
  } else if (lowerGender.includes('women')) {
    categoryId = '1968084031'; // Women's Clothing
  }
  
  return `${baseUrl}?k=${encodedQuery}&rh=n%3A${categoryId}&ref=nb_sb_noss`;
}

/**
 * Build Tata CLiQ search URL
 */
function buildTataCliqURL(query: string): string {
  const baseUrl = 'https://www.tatacliq.com/search/';
  
  // Clean and URL encode query (spaces become %20)
  const cleanQuery = query.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const encodedQuery = encodeURIComponent(cleanQuery);
  
  return `${baseUrl}?searchCategory=all&text=${encodedQuery}`;
}

/**
 * Build Myntra search URL
 */
function buildMyntraURL(query: string, gender: string): string {
  const baseUrl = 'https://www.myntra.com/';
  
  // Clean query
  const cleanQuery = query.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  
  // Create URL slug (lowercase, hyphens instead of spaces)
  const querySlug = cleanQuery.toLowerCase().replace(/\s+/g, '-');
  
  // Determine gender filter
  const lowerGender = gender.toLowerCase();
  let genderFilter = 'men,men women'; // Default: Unisex
  
  if (lowerGender.includes('men') && !lowerGender.includes('women')) {
    genderFilter = 'men';
  } else if (lowerGender.includes('women')) {
    genderFilter = 'women';
  }
  
  // Build final URL
  const rawQueryEncoded = encodeURIComponent(cleanQuery);
  
  return `${baseUrl}${querySlug}?f=Gender%3A${genderFilter}&rawQuery=${rawQueryEncoded}`;
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

interface ShoppingLink {
  item: string;
  url: string;
}

interface ShoppingLinks {
  byItem: {
    [itemName: string]: {
      amazon: string;
      myntra: string;
      tataCliq: string;
    };
  };
  byPlatform: {
    amazon: ShoppingLink[];
    myntra: ShoppingLink[];
    tataCliq: ShoppingLink[];
  };
}

/**
 * Generate shopping links for all platforms instantly
 * 
 * @param outfit - Outfit data from AI recommendation
 * @returns Structured shopping links by item and platform
 */
export function generateShoppingLinks(outfit: OutfitData): ShoppingLinks {
  const startTime = performance.now();
  
  const result: ShoppingLinks = {
    byItem: {},
    byPlatform: {
      amazon: [],
      myntra: [],
      tataCliq: [],
    },
  };
  
  // Process top 2 items (avoid overwhelming user)
  const itemsToProcess = outfit.items.slice(0, 2);
  
  for (const item of itemsToProcess) {
    // Generate queries for each platform
    const amazonQuery = buildSearchQuery(outfit, item, 'amazon');
    const myntraQuery = buildSearchQuery(outfit, item, 'myntra');
    const tataCliqQuery = buildSearchQuery(outfit, item, 'tatacliq');
    
    console.log(`🛒 Shopping queries for "${item}":`, {
      amazon: amazonQuery,
      myntra: myntraQuery,
      tataCliq: tataCliqQuery
    });
    
    // Build URLs
    const amazonUrl = buildAmazonURL(amazonQuery, outfit.gender);
    const myntraUrl = buildMyntraURL(myntraQuery, outfit.gender);
    const tataCliqUrl = buildTataCliqURL(tataCliqQuery);
    
    // Store by item
    result.byItem[item] = {
      amazon: amazonUrl,
      myntra: myntraUrl,
      tataCliq: tataCliqUrl,
    };
    
    // Store by platform
    result.byPlatform.amazon.push({ item, url: amazonUrl });
    result.byPlatform.myntra.push({ item, url: myntraUrl });
    result.byPlatform.tataCliq.push({ item, url: tataCliqUrl });
  }
  
  const endTime = performance.now();
  const generationTime = endTime - startTime;
  
  console.log(`[Shopping Links] Generated ${itemsToProcess.length * 3} URLs in ${generationTime.toFixed(2)}ms`);
  
  return result;
}

// ============================================================================
// FALLBACK AND VALIDATION
// ============================================================================

/**
 * Validate and provide fallback for generated URLs
 */
export function validateShoppingLinks(links: ShoppingLinks): boolean {
  try {
    // Check that all URLs are properly formatted
    for (const platform of ['amazon', 'myntra', 'tataCliq'] as const) {
      for (const link of links.byPlatform[platform]) {
        new URL(link.url); // Will throw if invalid
      }
    }
    return true;
  } catch (error) {
    console.error('[Shopping Links] Validation failed:', error);
    return false;
  }
}

/**
 * Get generic fallback links for when generation fails
 */
export function getFallbackLinks(gender: string, items: string[]): ShoppingLinks {
  const primaryItem = items[0] || 'clothing';
  const genderTerm = gender.toLowerCase().includes('women') ? 'women' : 'men';
  
  return {
    byItem: {
      [primaryItem]: {
        amazon: `https://www.amazon.in/s?k=${genderTerm}+${primaryItem}&rh=n%3A1968122031&ref=nb_sb_noss`,
        myntra: `https://www.myntra.com/${primaryItem}?f=Gender%3A${genderTerm}`,
        tataCliq: `https://www.tatacliq.com/search/?searchCategory=all&text=${genderTerm}%20${primaryItem}`,
      },
    },
    byPlatform: {
      amazon: [{ item: primaryItem, url: `https://www.amazon.in/s?k=${genderTerm}+${primaryItem}` }],
      myntra: [{ item: primaryItem, url: `https://www.myntra.com/${primaryItem}` }],
      tataCliq: [{ item: primaryItem, url: `https://www.tatacliq.com/search/?text=${primaryItem}` }],
    },
  };
}
