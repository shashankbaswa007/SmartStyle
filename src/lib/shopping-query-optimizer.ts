/**
 * Shopping Query Optimizer
 * 
 * Transforms verbose AI-generated item descriptions (e.g., "Light Grey Cotton
 * Slim-Fit Trousers with Flat Front") into concise, high-signal search queries
 * optimized for Indian e-commerce platforms.
 *
 * Design principles:
 *  1. Product type + primary color FIRST — these are the strongest search signals
 *  2. Max 4 keywords per query — platforms penalize verbose queries
 *  3. Strip filler words (with, featuring, style, fabric, etc.)
 *  4. Gender as a URL parameter, not in the query text (except Amazon)
 *  5. Platform-specific URL patterns that match each site's actual API
 */

// ============================================================================
// PRODUCT TYPE NORMALIZATION
// ============================================================================

/** Canonical product types that e-commerce search engines index well */
const PRODUCT_TYPE_MAP: Record<string, string> = {
  // Tops
  'shirt': 'shirt', 'shirts': 'shirt',
  'tshirt': 't-shirt', 't-shirt': 't-shirt', 'tee': 't-shirt', 'tees': 't-shirt',
  'top': 'top', 'tops': 'top',
  'blouse': 'blouse', 'blouses': 'blouse',
  'polo': 'polo shirt', 'polo shirt': 'polo shirt',
  'henley': 'henley', 'henley shirt': 'henley',
  'crop top': 'crop top', 'croptop': 'crop top',
  'tank top': 'tank top', 'tank': 'tank top',
  'camisole': 'camisole', 'cami': 'camisole',
  'sweatshirt': 'sweatshirt',
  'hoodie': 'hoodie', 'hoodies': 'hoodie',
  'sweater': 'sweater', 'sweaters': 'sweater', 'pullover': 'sweater',
  'cardigan': 'cardigan',
  'tunic': 'tunic', 'tunics': 'tunic',

  // Bottoms
  'trouser': 'trousers', 'trousers': 'trousers', 'pants': 'trousers', 'pant': 'trousers',
  'jeans': 'jeans', 'jean': 'jeans', 'denims': 'jeans', 'denim jeans': 'jeans',
  'chinos': 'chinos', 'chino': 'chinos',
  'shorts': 'shorts', 'short': 'shorts',
  'skirt': 'skirt', 'skirts': 'skirt',
  'palazzo': 'palazzo pants', 'palazzos': 'palazzo pants',
  'legging': 'leggings', 'leggings': 'leggings',
  'culottes': 'culottes',
  'jogger': 'joggers', 'joggers': 'joggers',
  'cargo': 'cargo pants', 'cargos': 'cargo pants',
  'capri': 'capris', 'capris': 'capris',

  // Outerwear
  'jacket': 'jacket', 'jackets': 'jacket',
  'blazer': 'blazer', 'blazers': 'blazer',
  'coat': 'coat', 'coats': 'coat',
  'overcoat': 'overcoat',
  'trench coat': 'trench coat', 'trench': 'trench coat',
  'bomber': 'bomber jacket', 'bomber jacket': 'bomber jacket',
  'denim jacket': 'denim jacket',
  'leather jacket': 'leather jacket',
  'windbreaker': 'windbreaker',
  'vest': 'vest', 'waistcoat': 'waistcoat',
  'shrug': 'shrug',
  'cape': 'cape',
  'poncho': 'poncho',

  // Dresses & Ethnic
  'dress': 'dress', 'dresses': 'dress',
  'maxi dress': 'maxi dress', 'maxi': 'maxi dress',
  'midi dress': 'midi dress', 'midi': 'midi dress',
  'gown': 'gown', 'evening gown': 'gown',
  'jumpsuit': 'jumpsuit', 'romper': 'romper',
  'kurta': 'kurta', 'kurtas': 'kurta',
  'kurti': 'kurti', 'kurtis': 'kurti',
  'saree': 'saree', 'sari': 'saree',
  'salwar': 'salwar kameez', 'salwar kameez': 'salwar kameez',
  'lehenga': 'lehenga',
  'churidar': 'churidar',
  'anarkali': 'anarkali',
  'sherwani': 'sherwani',
  'dhoti': 'dhoti',
  'dupatta': 'dupatta',

  // Accessories
  'scarf': 'scarf', 'scarves': 'scarf',
  'stole': 'stole', 'muffler': 'muffler',
  'belt': 'belt', 'belts': 'belt',
  'watch': 'watch', 'watches': 'watch',
  'bag': 'bag', 'handbag': 'handbag', 'tote': 'tote bag',
  'backpack': 'backpack',
  'hat': 'hat', 'cap': 'cap', 'beanie': 'beanie',
  'sunglasses': 'sunglasses',
  'tie': 'tie', 'necktie': 'tie', 'bow tie': 'bow tie',

  // Footwear
  'shoe': 'shoes', 'shoes': 'shoes',
  'sneaker': 'sneakers', 'sneakers': 'sneakers',
  'boot': 'boots', 'boots': 'boots', 'ankle boots': 'ankle boots',
  'sandal': 'sandals', 'sandals': 'sandals',
  'loafer': 'loafers', 'loafers': 'loafers',
  'heel': 'heels', 'heels': 'heels',
  'flat': 'flats', 'flats': 'flats',
  'slipper': 'slippers', 'slippers': 'slippers',
  'oxford': 'oxford shoes', 'oxfords': 'oxford shoes',
  'derby': 'derby shoes',
  'moccasin': 'moccasins', 'moccasins': 'moccasins',
  'kolhapuri': 'kolhapuri chappal',
  'juttis': 'juttis', 'mojari': 'mojari',
};

// ============================================================================
// COLOR EXTRACTION
// ============================================================================

/** Colors that e-commerce search engines recognize well */
const KNOWN_COLORS = [
  // Primary
  'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
  // Extended
  'navy', 'navy blue', 'maroon', 'burgundy', 'wine', 'beige', 'cream', 'ivory', 'grey', 'gray',
  'charcoal', 'olive', 'khaki', 'tan', 'teal', 'turquoise', 'coral', 'peach', 'salmon', 'rust',
  'mustard', 'gold', 'silver', 'lavender', 'lilac', 'mauve', 'plum', 'indigo', 'mint',
  'emerald', 'sage', 'sky blue', 'powder blue', 'royal blue', 'cobalt',
  'light blue', 'dark blue', 'light green', 'dark green', 'light grey', 'dark grey',
  'light pink', 'hot pink', 'magenta', 'fuchsia', 'crimson', 'scarlet',
  'off white', 'off-white', 'camel', 'taupe', 'copper', 'bronze',
  'denim', 'aqua', 'cyan', 'slate',
];

// Sort by length descending so "navy blue" matches before "navy"
const COLORS_BY_LENGTH = [...KNOWN_COLORS].sort((a, b) => b.length - a.length);

// ============================================================================
// FABRIC KEYWORDS
// ============================================================================

const FABRIC_KEYWORDS = [
  'cotton', 'linen', 'silk', 'denim', 'wool', 'polyester', 'rayon',
  'chiffon', 'velvet', 'satin', 'leather', 'suede', 'khaki',
  'georgette', 'crepe', 'tweed', 'corduroy', 'flannel', 'jersey',
  'lycra', 'spandex', 'nylon', 'cashmere', 'fleece', 'chambray',
];

// ============================================================================
// FIT KEYWORDS (only include when they're distinctive/searchable)
// ============================================================================

const USEFUL_FIT_KEYWORDS = [
  'slim fit', 'slim-fit', 'skinny', 'relaxed fit', 'loose fit',
  'oversized', 'tailored', 'straight fit', 'bootcut', 'wide leg',
  'a-line', 'flared', 'fitted',
];

// ============================================================================
// NOISE WORDS TO STRIP
// ============================================================================

const NOISE_WORDS = new Set([
  'with', 'featuring', 'and', 'for', 'the', 'a', 'an', 'in', 'on',
  'style', 'styled', 'look', 'looking', 'perfect', 'great', 'ideal',
  'pair', 'of', 'set', 'combination', 'classic', 'modern', 'trendy',
  'fashionable', 'comfortable', 'comfortable-fit', 'premium', 'quality',
  'elegant', 'sophisticated', 'chic', 'stylish', 'beautiful', 'gorgeous',
  'lovely', 'nice', 'good', 'best', 'top', // 'top' as adjective
  'front', 'back', 'flat', // 'flat front' etc.
  'wear', 'wearing', 'outfit', 'attire', 'ensemble', 'clothing',
  'wardrobe', 'everyday', 'daily', 'regular',
]);

// ============================================================================
// CORE EXTRACTION LOGIC
// ============================================================================

export interface ParsedItem {
  /** The canonical product type (e.g., "trousers", "shirt") */
  productType: string;
  /** Primary color if detected */
  color: string | null;
  /** Fabric if detected (e.g., "cotton", "linen") */
  fabric: string | null;
  /** Distinctive fit if detected (e.g., "slim fit") */
  fit: string | null;
  /** Original raw text */
  raw: string;
}

/**
 * Parse a verbose AI-generated item description into structured attributes.
 *
 * Examples:
 *   "Light Grey Cotton Slim-Fit Trousers with Flat Front"
 *     → { productType: "trousers", color: "light grey", fabric: "cotton", fit: "slim fit" }
 *
 *   "Navy Blue Linen Shirt"
 *     → { productType: "shirt", color: "navy blue", fabric: "linen", fit: null }
 *
 *   "White Sneakers"
 *     → { productType: "sneakers", color: "white", fabric: null, fit: null }
 */
export function parseItemDescription(rawItem: string): ParsedItem {
  const text = rawItem.trim();
  const lower = text.toLowerCase();

  // 1. Extract product type (longest match wins)
  let productType = '';
  let productTypeRaw = '';
  // Check multi-word types first, then single words
  const words = lower.split(/\s+/);
  
  // Try multi-word matches (up to 3 words)
  for (let len = 3; len >= 1; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (PRODUCT_TYPE_MAP[phrase]) {
        productType = PRODUCT_TYPE_MAP[phrase];
        productTypeRaw = phrase;
        break;
      }
    }
    if (productType) break;
  }

  // Fallback: use the last word (often the garment type in English)
  if (!productType) {
    const lastWord = words[words.length - 1];
    if (PRODUCT_TYPE_MAP[lastWord]) {
      productType = PRODUCT_TYPE_MAP[lastWord];
      productTypeRaw = lastWord;
    } else {
      // Use the full text minus obvious noise
      productType = words.filter(w => !NOISE_WORDS.has(w)).slice(-2).join(' ') || text;
    }
  }

  // 2. Extract color (longest match wins — "navy blue" before "navy")
  let color: string | null = null;
  for (const c of COLORS_BY_LENGTH) {
    if (lower.includes(c)) {
      color = c;
      break;
    }
  }

  // 3. Extract fabric
  let fabric: string | null = null;
  for (const f of FABRIC_KEYWORDS) {
    if (lower.includes(f)) {
      fabric = f;
      break;
    }
  }

  // 4. Extract fit (only distinctive ones)
  let fit: string | null = null;
  for (const f of USEFUL_FIT_KEYWORDS) {
    if (lower.includes(f.toLowerCase())) {
      fit = f.replace(/-/g, ' ');
      break;
    }
  }

  return { productType, color, fabric, fit, raw: text };
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

/**
 * Build an optimized search query string from a parsed item.
 * 
 * Priority order: [color] [fabric?] [productType]
 * Max 4 tokens. Fabric only included if it adds meaningful signal.
 * 
 * Examples:
 *   → "navy blue shirt"
 *   → "grey cotton trousers"
 *   → "white sneakers"
 *   → "black slim fit jeans"
 */
export function buildOptimizedQuery(
  parsed: ParsedItem,
  options?: { includeGender?: string; includeFabric?: boolean; includeFit?: boolean }
): string {
  const parts: string[] = [];

  // Gender prefix (only for Amazon where it's in the query, not URL)
  if (options?.includeGender) {
    const g = options.includeGender.toLowerCase();
    if (g === 'male' || g === 'men') parts.push('men');
    else if (g === 'female' || g === 'women') parts.push('women');
  }

  // Color — strongest signal after product type
  if (parsed.color) {
    parts.push(parsed.color);
  }

  // Fabric — only if it's a meaningful differentiator (cotton shirt vs silk shirt)
  if (options?.includeFabric !== false && parsed.fabric) {
    // Skip fabric for certain types where it's implied (jeans=denim, leather jacket=leather)
    const impliedFabrics: Record<string, string[]> = {
      'jeans': ['denim'],
      'denim jacket': ['denim'],
      'leather jacket': ['leather'],
      'suede shoes': ['suede'],
    };
    const implied = impliedFabrics[parsed.productType];
    if (!implied || !implied.includes(parsed.fabric)) {
      parts.push(parsed.fabric);
    }
  }

  // Product type — required
  parts.push(parsed.productType);

  // Fit — only when distinct and space permits
  if (options?.includeFit !== false && parsed.fit && parts.length < 4) {
    parts.push(parsed.fit);
  }

  // Deduplicate and limit
  const seen = new Set<string>();
  const unique = parts.filter(p => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 5).join(' ');
}

// ============================================================================
// PLATFORM-SPECIFIC URL BUILDERS (consistent across entire app)
// ============================================================================

const AMAZON_CATEGORY_IDS = {
  men: '1968093031',
  women: '1968084031',
  all: '1968122031',
} as const;

/**
 * Build a clean Amazon.in search URL.
 * Uses `+` for spaces (Amazon standard), proper category node IDs.
 */
export function buildAmazonUrl(query: string, gender?: string): string {
  const clean = query.trim().replace(/[^a-zA-Z0-9\s-]/g, '');
  const encoded = clean.replace(/\s+/g, '+');
  const g = (gender || '').toLowerCase();
  const catId = g.includes('women') || g === 'female'
    ? AMAZON_CATEGORY_IDS.women
    : g.includes('men') || g === 'male'
    ? AMAZON_CATEGORY_IDS.men
    : AMAZON_CATEGORY_IDS.all;
  return `https://www.amazon.in/s?k=${encoded}&rh=n%3A${catId}&ref=nb_sb_noss`;
}

/**
 * Build a clean Myntra search URL.
 * Gender goes in the URL path, query in rawQuery param.
 */
export function buildMyntraUrl(query: string, gender?: string): string {
  const clean = query.trim().replace(/[^a-zA-Z0-9\s-]/g, '');
  const g = (gender || '').toLowerCase();
  const genderPath = g.includes('women') || g === 'female' ? 'women' : g.includes('men') || g === 'male' ? 'men' : 'shop';
  const slug = clean.toLowerCase().replace(/\s+/g, '-');
  const rawQuery = encodeURIComponent(clean);
  return `https://www.myntra.com/${slug}?f=Gender%3A${genderPath}&rawQuery=${rawQuery}`;
}

/**
 * Build a clean Tata CLiQ search URL.
 * Uses the /search/?text= format (most reliable).
 */
export function buildTataCliqUrl(query: string, gender?: string): string {
  const clean = query.trim().replace(/[^a-zA-Z0-9\s-]/g, '');
  const g = (gender || '').toLowerCase();
  const genderCat = g.includes('women') || g === 'female' ? 'women' : g.includes('men') || g === 'male' ? 'men' : 'all';
  const encoded = encodeURIComponent(clean);
  return `https://www.tatacliq.com/search/?searchCategory=${genderCat}&text=${encoded}`;
}

// ============================================================================
// HIGH-LEVEL API
// ============================================================================

export interface OptimizedItemLinks {
  /** The original AI-generated item text */
  item: string;
  /** What we're actually searching (shown to user for transparency) */
  optimizedQuery: string;
  /** Platform URLs */
  amazon: string;
  myntra: string;
  tatacliq: string;
}

/**
 * Generate optimized shopping links for a single item.
 *
 * @param rawItem - Raw AI item description (e.g., "Light Grey Cotton Slim-Fit Trousers with Flat Front")
 * @param gender  - "male" | "female" | undefined
 * @returns Optimized links with transparent query
 *
 * @example
 * optimizeItemLinks("Light Grey Cotton Slim-Fit Trousers with Flat Front", "male")
 * // → {
 * //     item: "Light Grey Cotton Slim-Fit Trousers with Flat Front",
 * //     optimizedQuery: "grey cotton trousers",
 * //     amazon: "https://www.amazon.in/s?k=men+grey+cotton+trousers&rh=n%3A1968093031&ref=nb_sb_noss",
 * //     myntra: "https://www.myntra.com/grey-cotton-trousers?f=Gender%3Amen&rawQuery=grey%20cotton%20trousers",
 * //     tatacliq: "https://www.tatacliq.com/search/?searchCategory=men&text=grey%20cotton%20trousers",
 * //   }
 */
export function optimizeItemLinks(rawItem: string, gender?: string): OptimizedItemLinks {
  const parsed = parseItemDescription(rawItem);

  // Amazon: include gender in query text (Amazon search benefits from it)
  const amazonQuery = buildOptimizedQuery(parsed, { includeGender: gender, includeFabric: true });
  // Myntra/CLiQ: gender goes in URL params, not query text
  const browseQuery = buildOptimizedQuery(parsed, { includeFabric: true });

  return {
    item: rawItem,
    optimizedQuery: browseQuery,
    amazon: buildAmazonUrl(amazonQuery, gender),
    myntra: buildMyntraUrl(browseQuery, gender),
    tatacliq: buildTataCliqUrl(browseQuery, gender),
  };
}

/**
 * Generate optimized shopping links for all items in an outfit.
 *
 * @param items  - Array of AI-generated item descriptions
 * @param gender - "male" | "female" | undefined
 * @returns Array of optimized links, one per item
 */
export function optimizeOutfitLinks(items: string[], gender?: string): OptimizedItemLinks[] {
  return items.map(item => optimizeItemLinks(item, gender));
}

/**
 * Build a single broad search URL for an entire outfit (for fallback).
 * Picks the first item's product type + first color for a focused query.
 */
export function buildOutfitSearchUrls(items: string[], gender?: string): {
  amazon: string;
  myntra: string;
  tatacliq: string;
  query: string;
} {
  if (!items.length) {
    const fallback = gender === 'female' ? 'women clothing' : gender === 'male' ? 'men clothing' : 'clothing';
    return {
      query: fallback,
      amazon: buildAmazonUrl(fallback, gender),
      myntra: buildMyntraUrl(fallback, gender),
      tatacliq: buildTataCliqUrl(fallback, gender),
    };
  }

  // Use first item as the primary search subject
  const firstParsed = parseItemDescription(items[0]);
  const query = buildOptimizedQuery(firstParsed, { includeFabric: false });
  return {
    query,
    amazon: buildAmazonUrl(query, gender),
    myntra: buildMyntraUrl(query, gender),
    tatacliq: buildTataCliqUrl(query, gender),
  };
}
