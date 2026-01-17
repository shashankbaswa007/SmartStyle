/**
 * Shopping Query Builder - Platform-Specific Query Optimization
 * 
 * Transforms structured clothing item data from Gemini into optimized search queries
 * for Amazon India, Myntra, and Tata CLiQ, accounting for each platform's unique
 * search algorithm characteristics.
 */

export interface ClothingItem {
  itemNumber: number;
  type: string;
  gender: string;
  category: string; // top, bottom, outerwear, accessory
  style: string[];
  fit: string;
  fabric: string;
  color: string;
  pattern?: string;
  sleeveType?: string;
  neckline?: string;
  length?: string;
  occasion: string;
  season: string;
  priceRange: string;
  brandStyle?: string;
  specialFeatures: string[];
}

export interface StructuredAnalysis {
  items: ClothingItem[];
  overallStyle: string;
  colorHarmony: string;
  targetDemographic: string;
}

export interface PlatformQueries {
  amazon: string[];
  myntra: string[];
  tatacliq: string[];
}

// Color synonym mapping for fuzzy matching
export const COLOR_SYNONYMS: Record<string, string[]> = {
  // Oranges
  'burnt orange': ['rust', 'terracotta', 'copper', 'orange', 'burnt sienna', 'amber'],
  'rust orange': ['rust', 'terracotta', 'burnt orange', 'copper'],
  'coral orange': ['coral', 'orange', 'peach'],
  'tangerine': ['orange', 'bright orange', 'tangerine'],
  
  // Blues
  'navy blue': ['navy', 'dark blue', 'midnight blue', 'deep blue'],
  'powder blue': ['light blue', 'sky blue', 'baby blue', 'pale blue'],
  'cobalt blue': ['cobalt', 'royal blue', 'bright blue'],
  'turquoise blue': ['turquoise', 'teal', 'aqua', 'cyan'],
  'midnight blue': ['midnight', 'navy', 'dark blue', 'navy blue'],
  'sky blue': ['sky', 'light blue', 'powder blue', 'baby blue'],
  
  // Beiges and neutrals
  'cream beige': ['cream', 'beige', 'ivory', 'off-white', 'ecru'],
  'off white': ['off-white', 'cream', 'ivory', 'ecru', 'bone'],
  'ivory': ['cream', 'off-white', 'beige', 'eggshell'],
  
  // Grays
  'charcoal gray': ['charcoal', 'grey', 'gray', 'dark grey', 'slate'],
  'ash gray': ['ash', 'grey', 'gray', 'light grey', 'silver'],
  'slate gray': ['slate', 'grey', 'gray', 'charcoal'],
  
  // Greens
  'emerald green': ['emerald', 'green', 'forest green', 'deep green'],
  'olive green': ['olive', 'green', 'khaki', 'army green'],
  'mint green': ['mint', 'light green', 'pastel green'],
  'forest green': ['forest', 'dark green', 'emerald', 'deep green'],
  
  // Reds and pinks
  'burgundy': ['wine', 'maroon', 'deep red', 'dark red'],
  'wine red': ['wine', 'burgundy', 'maroon', 'deep red'],
  'coral pink': ['coral', 'pink', 'salmon', 'peach'],
  'hot pink': ['hot pink', 'bright pink', 'magenta', 'fuchsia'],
  'crimson': ['red', 'crimson', 'scarlet', 'ruby', 'deep red'],
  'scarlet': ['red', 'scarlet', 'crimson', 'bright red'],
  'ruby': ['red', 'ruby', 'crimson', 'deep red'],
  'red': ['red', 'crimson', 'scarlet', 'ruby', 'cherry red'],
  
  // Browns
  'chocolate brown': ['chocolate', 'brown', 'dark brown'],
  'tan brown': ['tan', 'brown', 'beige', 'camel'],
  'camel': ['tan', 'beige', 'camel', 'sand'],
  
  // Blacks and whites
  'jet black': ['black', 'jet', 'ebony'],
  'pure white': ['white', 'snow white', 'ivory'],
  'black': ['black', 'jet black', 'ebony', 'charcoal'],
  'white': ['white', 'pure white', 'snow white', 'off white', 'ivory'],
  'charcoal': ['charcoal', 'black', 'dark grey', 'slate'],
  
  // Purples
  'lavender': ['lavender', 'lilac', 'light purple', 'mauve'],
  'plum': ['plum', 'purple', 'dark purple', 'burgundy'],
  'mauve': ['mauve', 'lilac', 'lavender', 'dusty purple'],
  
  // Yellows
  'mustard yellow': ['mustard', 'yellow', 'golden yellow', 'ochre'],
  'lemon yellow': ['lemon', 'bright yellow', 'yellow'],
};

// Clothing type keywords for validation
const CLOTHING_TYPES = [
  'shirt', 'blouse', 't-shirt', 'tshirt', 'top', 'tee',
  'trouser', 'trousers', 'pants', 'jeans', 'jean',
  'skirt', 'dress', 'kurta', 'kurti', 'tunic',
  'jacket', 'blazer', 'coat', 'cardigan', 'sweater',
  'palazzo', 'culottes', 'shorts', 'leggings',
  'dhoti', 'salwar', 'dupatta', 'scarf',
  'jumpsuit', 'romper', 'co-ord', 'coord'
];

/**
 * Build Amazon India optimized query
 * Strategy: gender + color + fabric + fit + item type + style + "India"
 */
export function buildAmazonQuery(item: ClothingItem): string {
  const parts: string[] = [];
  
  // Gender (simplified for search)
  if (item.gender) {
    parts.push(item.gender.toLowerCase() === 'female' ? "women's" : 
                item.gender.toLowerCase() === 'male' ? "men's" : item.gender);
  }
  
  // Specific color (critical for Amazon)
  if (item.color && !item.color.includes('#')) {
    parts.push(item.color);
  }
  
  // Fabric type (quality indicator)
  if (item.fabric) {
    parts.push(item.fabric);
  }
  
  // Fit descriptor (only if non-standard)
  if (item.fit && !['regular', 'regular-fit', 'standard'].includes(item.fit.toLowerCase())) {
    parts.push(item.fit);
  }
  
  // Item type (required)
  if (item.type) {
    parts.push(item.type);
  }
  
  // First style keyword
  if (item.style && item.style.length > 0) {
    parts.push(item.style[0]);
  }
  
  // India location marker for regional results
  parts.push('India');
  
  return parts.filter(Boolean).join(' ').trim();
}

/**
 * Build Myntra optimized query
 * Strategy: item type + style descriptors + color + occasion + gender
 */
export function buildMyntraQuery(item: ClothingItem): string {
  const parts: string[] = [];
  
  // Item type first (Myntra prioritizes this)
  if (item.type) {
    parts.push(item.type);
  }
  
  // Style descriptors (Myntra understands fashion terminology)
  if (item.style && item.style.length > 0) {
    parts.push(item.style.join(' '));
  }
  
  // Color
  if (item.color && !item.color.includes('#')) {
    parts.push(item.color);
  }
  
  // Occasion (if special, not daily wear)
  if (item.occasion && !['daily casual', 'casual outing'].includes(item.occasion.toLowerCase())) {
    parts.push(item.occasion);
  }
  
  // Simplified gender (without possessive)
  if (item.gender) {
    const gender = item.gender.toLowerCase();
    parts.push(gender === 'female' ? 'women' : gender === 'male' ? 'men' : gender);
  }
  
  return parts.filter(Boolean).join(' ').trim();
}

/**
 * Build Tata CLiQ optimized query
 * Strategy: brand style + gender + fabric + color + item type + fit
 */
export function buildTataCliqQuery(item: ClothingItem): string {
  const parts: string[] = [];
  
  // Brand style hint (premium positioning)
  if (item.brandStyle) {
    parts.push(item.brandStyle);
  }
  
  // Gender
  if (item.gender) {
    parts.push(item.gender.toLowerCase() === 'female' ? "women's" : 
                item.gender.toLowerCase() === 'male' ? "men's" : item.gender);
  }
  
  // Fabric (quality indicator)
  if (item.fabric) {
    parts.push(item.fabric);
  }
  
  // Color
  if (item.color && !item.color.includes('#')) {
    parts.push(item.color);
  }
  
  // Item type
  if (item.type) {
    parts.push(item.type);
  }
  
  // Fit (if non-standard)
  if (item.fit && !['regular', 'regular-fit', 'standard'].includes(item.fit.toLowerCase())) {
    parts.push(item.fit);
  }
  
  return parts.filter(Boolean).join(' ').trim();
}

/**
 * Build fallback query (simplified)
 * Strategy: gender + color + item type
 */
export function buildFallbackQuery(item: ClothingItem): string {
  const parts: string[] = [];
  
  if (item.gender) {
    const gender = item.gender.toLowerCase();
    parts.push(gender === 'female' ? 'women' : gender === 'male' ? 'men' : gender);
  }
  
  if (item.color && !item.color.includes('#')) {
    parts.push(item.color);
  }
  
  if (item.type) {
    parts.push(item.type);
  }
  
  return parts.filter(Boolean).join(' ').trim();
}

/**
 * Validate query before searching
 */
export function isQueryValid(query: string): boolean {
  // Must have at least 3 words
  const words = query.trim().split(/\s+/);
  if (words.length < 3) {
    return false;
  }
  
  // Must contain at least one clothing type keyword
  const lowerQuery = query.toLowerCase();
  const hasClothingType = CLOTHING_TYPES.some(type => lowerQuery.includes(type));
  
  return hasClothingType;
}

/**
 * Main function: Build shopping queries for all items across all platforms
 */
export function buildShoppingQueries(structuredData: StructuredAnalysis): PlatformQueries {
  const amazonQueries: string[] = [];
  const myntraQueries: string[] = [];
  const tatacliqQueries: string[] = [];
  
  for (const item of structuredData.items) {
    // Generate platform-specific queries
    const amazonQuery = buildAmazonQuery(item);
    const myntraQuery = buildMyntraQuery(item);
    const tatacliqQuery = buildTataCliqQuery(item);
    
    // Use fallback if primary query is invalid
    amazonQueries.push(isQueryValid(amazonQuery) ? amazonQuery : buildFallbackQuery(item));
    myntraQueries.push(isQueryValid(myntraQuery) ? myntraQuery : buildFallbackQuery(item));
    tatacliqQueries.push(isQueryValid(tatacliqQuery) ? tatacliqQuery : buildFallbackQuery(item));
  }
  
  return {
    amazon: amazonQueries,
    myntra: myntraQueries,
    tatacliq: tatacliqQueries,
  };
}

/**
 * Get color synonyms for fuzzy matching
 */
export function getColorSynonyms(color: string): string[] {
  const lowerColor = color.toLowerCase();
  
  // Check if we have an exact match in our synonym map
  if (COLOR_SYNONYMS[lowerColor]) {
    return COLOR_SYNONYMS[lowerColor];
  }
  
  // Check if the color is a synonym of any key
  for (const [key, synonyms] of Object.entries(COLOR_SYNONYMS)) {
    if (synonyms.includes(lowerColor)) {
      return [key, ...synonyms];
    }
  }
  
  // Return individual words as partial matches
  const words = lowerColor.split(/\s+/);
  return words.length > 1 ? words : [lowerColor];
}

/**
 * Calculate color match score for search result
 */
export function calculateColorMatchScore(targetColor: string, resultText: string): number {
  const lowerResult = resultText.toLowerCase();
  const lowerTarget = targetColor.toLowerCase();
  
  // Exact match (highest score)
  if (lowerResult.includes(lowerTarget)) {
    return 1.0;
  }
  
  // Check synonyms
  const synonyms = getColorSynonyms(targetColor);
  for (const synonym of synonyms) {
    if (lowerResult.includes(synonym.toLowerCase())) {
      return 0.8;
    }
  }
  
  // Partial word matches
  const targetWords = lowerTarget.split(/\s+/);
  const matchedWords = targetWords.filter(word => lowerResult.includes(word));
  
  if (matchedWords.length > 0) {
    return 0.5 * (matchedWords.length / targetWords.length);
  }
  
  return 0.0;
}
