/**
 * Shopping Query Optimizer — Single Source of Truth
 *
 * Deterministic, platform-aware query builder that derives shopping queries
 * from structured recommendation attributes (color, material, product type,
 * optional context) — never from raw descriptive text.
 *
 * KEYWORD ORDER:  [COLOR] → [MATERIAL] → [PRODUCT_TYPE] → [OPTIONAL_DESCRIPTOR]
 * TARGET:         3–4 high-signal keywords, singular product terms
 * GUARDRAILS:     No full sentences, no brand names, no sizes, no verbose adjectives
 *
 * PLATFORM URL PATTERNS:
 *   Amazon    — /s?k=light+blue+cotton+shirt+men  (spaces = +)
 *   Tata CLiQ — /search/?searchCategory=all&text=light%20blue%20cotton%20shirt  (spaces = %20)
 *   Myntra    — /light-blue-cotton-shirt?rawQuery=light%20blue%20cotton%20shirt  (SEO path + rawQuery)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT TYPE NORMALIZATION — maps plural/alias → singular canonical form
// ═══════════════════════════════════════════════════════════════════════════════

const PRODUCT_TYPE_MAP: Record<string, string> = {
  // Tops
  shirt: 'shirt', shirts: 'shirt',
  tshirt: 't-shirt', 't-shirt': 't-shirt', tee: 't-shirt', tees: 't-shirt',
  top: 'top', tops: 'top',
  blouse: 'blouse', blouses: 'blouse',
  'polo shirt': 'polo shirt', polo: 'polo shirt',
  henley: 'henley', 'henley shirt': 'henley',
  'crop top': 'crop top', croptop: 'crop top',
  'tank top': 'tank top', tank: 'tank top',
  camisole: 'camisole', cami: 'camisole',
  sweatshirt: 'sweatshirt',
  hoodie: 'hoodie', hoodies: 'hoodie',
  sweater: 'sweater', sweaters: 'sweater', pullover: 'sweater',
  cardigan: 'cardigan',
  tunic: 'tunic', tunics: 'tunic',

  // Bottoms
  trouser: 'trouser', trousers: 'trouser', pants: 'trouser', pant: 'trouser',
  jeans: 'jeans', jean: 'jeans', denims: 'jeans', 'denim jeans': 'jeans',
  chinos: 'chino', chino: 'chino',
  shorts: 'shorts', short: 'shorts',
  skirt: 'skirt', skirts: 'skirt',
  palazzo: 'palazzo', palazzos: 'palazzo', 'palazzo pants': 'palazzo',
  legging: 'legging', leggings: 'legging',
  culottes: 'culotte',
  jogger: 'jogger', joggers: 'jogger',
  cargo: 'cargo pant', cargos: 'cargo pant', 'cargo pants': 'cargo pant',
  capri: 'capri', capris: 'capri',

  // Outerwear
  jacket: 'jacket', jackets: 'jacket',
  'tuxedo jacket': 'tuxedo jacket', tuxedo: 'tuxedo jacket',
  'suit jacket': 'jacket', 'sports jacket': 'jacket',
  blazer: 'blazer', blazers: 'blazer',
  coat: 'coat', coats: 'coat',
  overcoat: 'overcoat',
  'trench coat': 'trench coat', trench: 'trench coat',
  'bomber jacket': 'bomber jacket', bomber: 'bomber jacket',
  'denim jacket': 'denim jacket',
  'leather jacket': 'leather jacket',
  windbreaker: 'windbreaker',
  vest: 'vest', waistcoat: 'waistcoat',
  shrug: 'shrug',
  cape: 'cape',
  poncho: 'poncho',

  // Dresses & Ethnic
  dress: 'dress', dresses: 'dress',
  'maxi dress': 'maxi dress', maxi: 'maxi dress',
  'midi dress': 'midi dress', midi: 'midi dress',
  gown: 'gown', 'evening gown': 'gown',
  jumpsuit: 'jumpsuit', romper: 'romper',
  kurta: 'kurta', kurtas: 'kurta',
  kurti: 'kurti', kurtis: 'kurti',
  saree: 'saree', sari: 'saree',
  'salwar kameez': 'salwar kameez', salwar: 'salwar kameez',
  lehenga: 'lehenga',
  churidar: 'churidar',
  anarkali: 'anarkali',
  sherwani: 'sherwani',
  dhoti: 'dhoti',
  dupatta: 'dupatta',

  // Accessories
  scarf: 'scarf', scarves: 'scarf',
  stole: 'stole', muffler: 'muffler',
  belt: 'belt', belts: 'belt', 'leather belt': 'belt',
  watch: 'watch', watches: 'watch', wristwatch: 'watch', timepiece: 'watch',
  bag: 'bag', handbag: 'handbag', tote: 'tote bag', purse: 'handbag',
  backpack: 'backpack',
  hat: 'hat', cap: 'cap', beanie: 'beanie',
  sunglasses: 'sunglasses', shades: 'sunglasses',
  tie: 'tie', necktie: 'tie', 'bow tie': 'bow tie', 'silk tie': 'tie',
  'pocket square': 'pocket square', handkerchief: 'pocket square',

  // Footwear
  shoe: 'shoe', shoes: 'shoe',
  sneaker: 'sneaker', sneakers: 'sneaker',
  boot: 'boot', boots: 'boot', 'ankle boots': 'ankle boot',
  sandal: 'sandal', sandals: 'sandal',
  loafer: 'loafer', loafers: 'loafer',
  heel: 'heel', heels: 'heel',
  flat: 'flat', flats: 'flat',
  slipper: 'slipper', slippers: 'slipper',
  oxford: 'oxford shoe', oxfords: 'oxford shoe', 'oxford shoes': 'oxford shoe',
  'patent leather oxford': 'oxford shoe', 'patent leather oxfords': 'oxford shoe',
  derby: 'derby shoe', derbies: 'derby shoe',
  brogue: 'brogue', brogues: 'brogue',
  monk: 'monk strap', 'monk strap': 'monk strap',
  moccasin: 'moccasin', moccasins: 'moccasin',
  kolhapuri: 'kolhapuri chappal',
  juttis: 'jutti', mojari: 'mojari',
};

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR LIST — sorted by length desc so "navy blue" matches before "navy"
// ═══════════════════════════════════════════════════════════════════════════════

const KNOWN_COLORS = [
  // Multi-word colors (check these first - longest to shortest)
  'navy blue', 'sky blue', 'powder blue', 'royal blue', 'light blue', 'dark blue', 'cobalt blue', 'electric blue',
  'light green', 'dark green', 'olive green', 'mint green', 'emerald green', 'sage green', 'forest green', 'lime green',
  'light grey', 'dark grey', 'charcoal grey', 'slate grey', 'ash grey',
  'light pink', 'hot pink', 'dusty pink', 'baby pink', 'rose pink',
  'off white', 'off-white', 'eggshell white',
  'burnt orange', 'burnt sienna',
  'deep red', 'wine red', 'blood red',
  'pastel blue', 'pastel pink', 'pastel yellow', 'pastel green',
  
  // Single-word colors with high recognition value
  'burgundy', 'magenta', 'fuchsia', 'crimson', 'scarlet', 'vermillion',
  'turquoise', 'teal', 'aqua', 'cyan',
  'lavender', 'charcoal', 'mustard', 'emerald', 'maroon',
  'indigo', 'salmon', 'copper', 'bronze', 'silver', 'gold', 'rose gold',
  'coral', 'peach', 'olive', 'khaki', 'ivory', 'cream',
  'beige', 'camel', 'taupe', 'mauve', 'lilac',
  'slate', 'denim', 'rust', 'mint', 'sage', 'wine', 'plum',
  
  // Basic colors (check last)
  'black', 'white', 'brown', 'green', 'blue', 'grey', 'gray', 'navy',
  'red', 'pink', 'yellow', 'orange', 'purple', 'tan', 'violet',
];

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL KEYWORDS
// ═══════════════════════════════════════════════════════════════════════════════

const MATERIAL_KEYWORDS = [
  'cotton', 'linen', 'silk', 'denim', 'wool', 'polyester', 'rayon',
  'chiffon', 'velvet', 'satin', 'leather', 'patent leather', 'suede', 'khaki',
  'georgette', 'crepe', 'tweed', 'corduroy', 'flannel', 'jersey',
  'lycra', 'spandex', 'nylon', 'cashmere', 'fleece', 'chambray',
  'canvas', 'acrylic', 'viscose', 'modal', 'bamboo', 'hemp',
  'oxford', 'poplin', 'muslin', 'taffeta', 'organza', 'tulle',
  'metal', 'silver', 'gold', 'brass', 'stainless steel', // for accessories
];

// ═══════════════════════════════════════════════════════════════════════════════
// OPTIONAL DESCRIPTORS — only included when they add material search value
// ═══════════════════════════════════════════════════════════════════════════════

const USEFUL_DESCRIPTORS = [
  'slim fit', 'slim-fit', 'skinny', 'relaxed fit', 'loose fit',
  'oversized', 'tailored', 'straight fit', 'bootcut', 'wide leg',
  'a-line', 'flared', 'fitted',
];

// ═══════════════════════════════════════════════════════════════════════════════
// NOISE WORDS — stripped before any processing
// ═══════════════════════════════════════════════════════════════════════════════

const NOISE_WORDS = new Set([
  'with', 'featuring', 'and', 'for', 'the', 'a', 'an', 'in', 'on', 'of',
  'style', 'styled', 'look', 'looking', 'perfect', 'great', 'ideal',
  'pair', 'set', 'combination', 'classic', 'modern', 'trendy',
  'fashionable', 'comfortable', 'premium', 'quality',
  'elegant', 'sophisticated', 'chic', 'stylish', 'beautiful', 'gorgeous',
  'lovely', 'nice', 'good', 'best',
  'front', 'back', 'flat',
  'wear', 'wearing', 'outfit', 'attire', 'ensemble', 'clothing',
  'wardrobe', 'everyday', 'daily', 'regular',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// CORE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParsedItem {
  productType: string;
  color: string | null;
  material: string | null;
  descriptor: string | null;
  raw: string;
}

/**
 * Normalize raw AI-generated item text by removing hex codes, verbose phrases, and tailoring jargon.
 * 
 * Examples:
 *   "Black peak lapel tuxedo jacket made of wool" → "black wool tuxedo jacket"
 *   "White dress shirt with a wingtip collar made of cotton" → "white cotton dress shirt"
 *   "Crisp white cotton dress shirt (#FFFFFF) with elegant styling" → "white cotton dress shirt"
 */
function normalizeItemText(rawItem: string): string {
  let text = rawItem.trim();
  
  // 1. Remove hex codes: (#RRGGBB) or (hex: #RRGGBB) or #RRGGBB anywhere
  text = text.replace(/\(\s*#?[0-9A-Fa-f]{6}\s*\)/g, '');
  text = text.replace(/\(\s*hex:\s*#?[0-9A-Fa-f]{6}\s*\)/gi, '');
  text = text.replace(/\s+#[0-9A-Fa-f]{6}\b/g, '');
  
  // 2. Remove "made of [material]" patterns (redundant since material is already in text)
  text = text.replace(/\bmade\s+of\s+\w+/gi, '');
  text = text.replace(/\bcrafted\s+from\s+\w+/gi, '');
  text = text.replace(/\bin\s+\w+\s+fabric/gi, '');
  
  // 3. Remove collar/lapel/neckline details (too specific for e-commerce search)
  const tailoringDetails = [
    /\bwith\s+a\s+(wingtip|spread|point|button-down|mandarin|club|cutaway)\s+collar/gi,
    /\b(peak|notch|shawl|lapel)\s+lapel/gi,
    /\bwith\s+(peak|notch|shawl)\s+lapels?/gi,
    /\b(v-neck|crew\s+neck|round\s+neck|boat\s+neck|cowl\s+neck|mock\s+neck)/gi,
    /\bwith\s+a\s+(single|double)\s+button/gi,
    /\b(single|double)-breasted/gi,
  ];
  
  for (const pattern of tailoringDetails) {
    text = text.replace(pattern, '');
  }
  
  // 4. Remove construction/fit details (e.g., "with pleated front", "with flat front")
  const constructionDetails = [
    /\bwith\s+(pleated|flat|pressed)\s+(front|back|sides?)/gi,
    /\bwith\s+(side|welt|patch)\s+pockets?/gi,
    /\b(full|half|three-quarter)\s+sleeves?/gi,
    /\bwith\s+functional\s+buttons?/gi,
    /\bfully\s+lined/gi,
  ];
  
  for (const pattern of constructionDetails) {
    text = text.replace(pattern, '');
  }
  
  // 5. Remove verbose AI phrasing patterns
  const verbosePatterns = [
    /\bwith\s+(elegant|sophisticated|modern|classic|timeless|perfect|ideal|great|beautiful|clean|sharp|polished)\s+\w+/gi,
    /\bfeaturing\s+[^,\.]+/gi,
    /\b(elegant|sophisticated|modern|classic|timeless|perfect|polished|refined|tailored)\s+(styling|design|look|aesthetic|finish|details?)/gi,
    /\s+(for|to)\s+(create|achieve|ensure|provide|give|add|complete)\s+[^,\.]+/gi,
    /\bthat\s+(creates?|adds?|provides?|ensures?)\s+[^,\.]+/gi,
  ];
  
  for (const pattern of verbosePatterns) {
    text = text.replace(pattern, '');
  }
  
  // 6. Clean up common redundant adjectives (only when not color-related)
  const redundantWords = [
    'crisp', 'simple', 'elegant', 'sophisticated', 'modern', 'classic', 'perfect', 'ideal',
    'sleek', 'polished', 'refined', 'sharp', 'clean', 'contemporary', 'timeless',
    'premium', 'luxurious', 'quality', 'stylish', 'fashionable'
  ];
  
  const words = text.split(/\s+/);
  const filtered = words.filter((word, idx) => {
    const lower = word.toLowerCase().replace(/[,\.;]/g, '');
    // Keep if it's not a redundant word
    if (!redundantWords.includes(lower)) return true;
    
    // Keep adjectives only if they precede essential product terms
    const nextWord = words[idx + 1]?.toLowerCase().replace(/[,\.;]/g, '');
    const essentialTerms = ['shirt', 'jacket', 'trouser', 'shoe', 'watch', 'tie', 'belt', 'dress', 'blazer'];
    return nextWord && essentialTerms.some(t => nextWord.includes(t));
  });
  text = filtered.join(' ');
  
  // 7. Remove material type when it appears after the product (redundant position)
  // e.g., "tuxedo jacket wool" → "wool tuxedo jacket" (will be reordered by parser)
  // We'll let the parser handle this via proper extraction
  
  // 8. Normalize whitespace and punctuation
  text = text.replace(/[,\(\)]+/g, ' ');
  text = text.replace(/\s+/g, ' ');
  text = text.trim();
  
  return text;
}

/**
 * Parse a verbose AI-generated item description into structured attributes.
 *
 *   "Light Grey Cotton Slim-Fit Trousers with Flat Front"
 *     → { productType: "trouser", color: "light grey", material: "cotton", descriptor: "slim fit" }
 *
 *   "Navy Blue Linen Shirt"
 *     → { productType: "shirt", color: "navy blue", material: "linen", descriptor: null }
 *
 *   "Navy blue wool suit jacket (#032B44)" 
 *     → { productType: "jacket", color: "navy blue", material: "wool", descriptor: null }
 */
export function parseItemDescription(rawItem: string): ParsedItem {
  // First normalize the text to remove hex codes and verbosity
  const normalized = normalizeItemText(rawItem);
  const text = normalized.trim();
  const lower = text.toLowerCase();

  // 1. Extract product type — multi-word matches first (up to 3 words), then single
  let productType = '';
  const words = lower.split(/\s+/);

  // Special handling for compound terms like "suit jacket" → "jacket"
  const compoundHandling: Record<string, string> = {
    'suit jacket': 'jacket',
    'dress shirt': 'shirt',
    'oxford shoe': 'oxford shoe',
    'polo shirt': 'polo shirt',
  };
  
  // Check compound terms first
  for (let len = 3; len >= 2; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (compoundHandling[phrase]) {
        productType = compoundHandling[phrase];
        break;
      }
    }
    if (productType) break;
  }
  
  // Then check standard product type map
  if (!productType) {
    for (let len = 3; len >= 1; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (PRODUCT_TYPE_MAP[phrase]) {
          productType = PRODUCT_TYPE_MAP[phrase];
          break;
        }
      }
      if (productType) break;
    }
  }

  // Fallback: use last non-noise word
  if (!productType) {
    const meaningful = words.filter(w => !NOISE_WORDS.has(w));
    const last = meaningful[meaningful.length - 1];
    productType = last ? (PRODUCT_TYPE_MAP[last] || last) : text;
  }

  // 2. Extract color — longest match first
  let color: string | null = null;
  for (const c of KNOWN_COLORS) {
    if (lower.includes(c)) {
      color = c;
      break;
    }
  }
  // Normalize grey/gray
  if (color) color = color.replace('gray', 'grey');

  // 3. Extract material
  let material: string | null = null;
  for (const m of MATERIAL_KEYWORDS) {
    if (lower.includes(m)) {
      // Skip when material is implied by product type
      const implied: Record<string, string[]> = {
        jeans: ['denim'], 'denim jacket': ['denim'],
        'leather jacket': ['leather'], 'suede shoe': ['suede'],
      };
      if (implied[productType]?.includes(m)) continue;
      material = m;
      break;
    }
  }

  // 4. Extract optional descriptor
  let descriptor: string | null = null;
  for (const d of USEFUL_DESCRIPTORS) {
    if (lower.includes(d.toLowerCase())) {
      descriptor = d.replace(/-/g, ' ').trim();
      break;
    }
  }

  return { productType, color, material, descriptor, raw: text };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY BUILDER — deterministic keyword ordering
// ═══════════════════════════════════════════════════════════════════════════════

export interface QueryOptions {
  /** "male" | "female" — appended as "men" / "women" only when it improves relevance */
  gender?: string;
  /** Include material keyword (default true) */
  includeMaterial?: boolean;
  /** Include fit/descriptor keyword (default false — only when space permits) */
  includeDescriptor?: boolean;
}

/**
 * Build a deterministic search query from parsed attributes.
 *
 * Ordering: [COLOR] → [MATERIAL] → [PRODUCT_TYPE] → [GENDER/DESCRIPTOR]
 * Limit:    3–4 keywords
 * Fallback: If color missing → material + product type; if both missing → product type only
 *
 * Examples:
 *   → "light blue cotton shirt men"
 *   → "navy blue linen trouser"
 *   → "white sneaker"
 *   → "black slim fit jeans"
 */
export function buildOptimizedQuery(parsed: ParsedItem, options: QueryOptions = {}): string {
  const parts: string[] = [];

  // [COLOR] — strongest search signal after product type
  if (parsed.color) {
    parts.push(parsed.color);
  }

  // [MATERIAL] — only when it meaningfully differentiates
  if (options.includeMaterial !== false && parsed.material) {
    parts.push(parsed.material);
  }

  // [PRODUCT_TYPE] — always required
  parts.push(parsed.productType);

  // [OPTIONAL_DESCRIPTOR] — gender or fit, only when space permits (≤ 4 keywords)
  if (options.gender && parts.length < 4) {
    const g = options.gender.toLowerCase();
    if (g === 'male' || g === 'men') parts.push('men');
    else if (g === 'female' || g === 'women') parts.push('women');
  } else if (options.includeDescriptor && parsed.descriptor && parts.length < 4) {
    parts.push(parsed.descriptor);
  }

  // Deduplicate (case-insensitive) and enforce 4-keyword cap
  const seen = new Set<string>();
  return parts
    .filter(p => {
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4)
    .join(' ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM-SPECIFIC URL BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Amazon India — /s?k= format, spaces encoded as +
 * Example: https://www.amazon.in/s?k=light+blue+cotton+shirt+men
 */
export function buildAmazonUrl(query: string): string {
  const clean = query.trim().replace(/[^a-zA-Z0-9\s-]/g, '');
  const encoded = clean.replace(/\s+/g, '+');
  return `https://www.amazon.in/s?k=${encoded}`;
}

/**
 * Tata CLiQ — /search/?searchCategory=all&text= format, spaces encoded as %20
 * Always includes searchCategory=all.
 * Example: https://www.tatacliq.com/search/?searchCategory=all&text=light%20blue%20cotton%20shirt
 */
export function buildTataCliqUrl(query: string): string {
  const clean = query.trim().replace(/[^a-zA-Z0-9\s-]/g, '');
  const encoded = encodeURIComponent(clean);
  return `https://www.tatacliq.com/search/?searchCategory=all&text=${encoded}`;
}

/**
 * Myntra — hyphenated SEO-friendly path + rawQuery param
 * Example: https://www.myntra.com/light-blue-cotton-shirt-men?rawQuery=light%20blue%20cotton%20shirt%20men
 */
export function buildMyntraUrl(query: string): string {
  const clean = query.trim().replace(/[^a-zA-Z0-9\s-]/g, '');
  const slug = clean.toLowerCase().replace(/\s+/g, '-');
  const rawQuery = encodeURIComponent(clean);
  return `https://www.myntra.com/${slug}?rawQuery=${rawQuery}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGH-LEVEL API — single item
// ═══════════════════════════════════════════════════════════════════════════════

export interface OptimizedItemLinks {
  /** Original AI-generated item text */
  item: string;
  /** The concise query actually used (for debugging / transparency) */
  optimizedQuery: string;
  /** Platform URLs */
  amazon: string;
  myntra: string;
  tatacliq: string;
}

/**
 * Generate optimized shopping links for a single item.
 *
 * @param rawItem - Raw AI description, e.g. "Light Grey Cotton Slim-Fit Trousers with Flat Front"
 * @param gender  - "male" | "female" | undefined
 *
 * @example
 * optimizeItemLinks("Light Grey Cotton Slim-Fit Trousers with Flat Front", "male")
 * // → {
 * //     optimizedQuery: "light grey cotton trouser men",
 * //     amazon:  "https://www.amazon.in/s?k=light+grey+cotton+trouser+men",
 * //     myntra:  "https://www.myntra.com/light-grey-cotton-trouser-men?rawQuery=light%20grey%20cotton%20trouser%20men",
 * //     tatacliq:"https://www.tatacliq.com/search/?searchCategory=all&text=light%20grey%20cotton%20trouser",
 * //   }
 */
export function optimizeItemLinks(rawItem: string, gender?: string): OptimizedItemLinks {
  console.log('🔍 [SHOPPING] Processing item:', rawItem);
  
  const parsed = parseItemDescription(rawItem);
  console.log('📊 [SHOPPING] Parsed attributes:', {
    productType: parsed.productType,
    color: parsed.color,
    material: parsed.material,
    descriptor: parsed.descriptor,
  });

  // Amazon + Myntra: include gender as the 4th keyword when space permits
  const queryWithGender = buildOptimizedQuery(parsed, {
    gender,
    includeMaterial: true,
  });

  // Tata CLiQ: gender-neutral query (searchCategory=all handles filtering)
  const queryNoGender = buildOptimizedQuery(parsed, {
    includeMaterial: true,
  });
  
  console.log('✅ [SHOPPING] Generated queries:', {
    withGender: queryWithGender,
    noGender: queryNoGender,
  });

  return {
    item: rawItem,
    optimizedQuery: queryWithGender,
    amazon: buildAmazonUrl(queryWithGender),
    myntra: buildMyntraUrl(queryWithGender),
    tatacliq: buildTataCliqUrl(queryNoGender),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGH-LEVEL API — full outfit (batch)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate optimized shopping links for every item in an outfit.
 */
export function optimizeOutfitLinks(items: string[], gender?: string): OptimizedItemLinks[] {
  return items.map(item => optimizeItemLinks(item, gender));
}

/**
 * Build a single broad fallback search URL for an outfit (first item's type + color).
 */
export function buildOutfitSearchUrls(items: string[], gender?: string): {
  amazon: string;
  myntra: string;
  tatacliq: string;
  query: string;
} {
  if (!items.length) {
    const fallback = gender === 'female' || gender === 'women'
      ? 'women clothing'
      : gender === 'male' || gender === 'men'
        ? 'men clothing'
        : 'clothing';
    return {
      query: fallback,
      amazon: buildAmazonUrl(fallback),
      myntra: buildMyntraUrl(fallback),
      tatacliq: buildTataCliqUrl(fallback),
    };
  }

  // Focus on first item for a clean search
  const parsed = parseItemDescription(items[0]);
  const query = buildOptimizedQuery(parsed, { gender, includeMaterial: false });
  return {
    query,
    amazon: buildAmazonUrl(query),
    myntra: buildMyntraUrl(query),
    tatacliq: buildTataCliqUrl(query),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER-SIDE COMPAT — replaces generateShoppingLinks from shopping-link-generator
//
// The recommend API route calls generateShoppingLinks({ gender, items, colorPalette, ... })
// and expects { byPlatform: { amazon: [{url}], myntra: [{url}], tataCliq: [{url}] }, byItem }
// ═══════════════════════════════════════════════════════════════════════════════

interface HexColorMapping { hex: string; name: string }

const HEX_COLOR_LOOKUP: HexColorMapping[] = [
  { hex: '#000080', name: 'navy blue' }, { hex: '#0000FF', name: 'blue' },
  { hex: '#87CEEB', name: 'sky blue' }, { hex: '#4169E1', name: 'royal blue' },
  { hex: '#1E3A8A', name: 'navy blue' }, { hex: '#3B82F6', name: 'blue' },
  { hex: '#FF0000', name: 'red' }, { hex: '#DC143C', name: 'crimson' },
  { hex: '#8B0000', name: 'maroon' }, { hex: '#FFC0CB', name: 'pink' },
  { hex: '#EF4444', name: 'red' }, { hex: '#FCA5A5', name: 'light pink' },
  { hex: '#008000', name: 'green' }, { hex: '#556B2F', name: 'olive' },
  { hex: '#10B981', name: 'green' }, { hex: '#14532D', name: 'dark green' },
  { hex: '#FFFF00', name: 'yellow' }, { hex: '#FFD700', name: 'gold' },
  { hex: '#FFA500', name: 'orange' }, { hex: '#F97316', name: 'orange' },
  { hex: '#800080', name: 'purple' }, { hex: '#A855F7', name: 'purple' },
  { hex: '#000000', name: 'black' }, { hex: '#FFFFFF', name: 'white' },
  { hex: '#808080', name: 'grey' }, { hex: '#A9A9A9', name: 'light grey' },
  { hex: '#D3D3D3', name: 'light grey' }, { hex: '#2F4F4F', name: 'charcoal' },
  { hex: '#8B4513', name: 'brown' }, { hex: '#D2691E', name: 'brown' },
  { hex: '#CD853F', name: 'tan' }, { hex: '#DEB887', name: 'beige' },
  { hex: '#F5F5DC', name: 'beige' }, { hex: '#FFFFF0', name: 'cream' },
  { hex: '#800000', name: 'maroon' }, { hex: '#FAEBD7', name: 'cream' },
  { hex: '#FF6347', name: 'coral' }, { hex: '#FF7F50', name: 'coral' },
  { hex: '#E0BBE4', name: 'lavender' }, { hex: '#9370DB', name: 'lavender' },
];

function hexToColorName(hex: string): string {
  const norm = hex.toUpperCase().replace('#', '');
  const exact = HEX_COLOR_LOOKUP.find(c => c.hex.toUpperCase().replace('#', '') === norm);
  if (exact) return exact.name;

  // Nearest by Euclidean distance in RGB
  const r = parseInt(norm.substring(0, 2), 16);
  const g = parseInt(norm.substring(2, 4), 16);
  const b = parseInt(norm.substring(4, 6), 16);

  let minDist = Infinity;
  let closest = '';
  for (const c of HEX_COLOR_LOOKUP) {
    const ch = c.hex.replace('#', '');
    const cr = parseInt(ch.substring(0, 2), 16);
    const cg = parseInt(ch.substring(2, 4), 16);
    const cb = parseInt(ch.substring(4, 6), 16);
    const d = Math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2);
    if (d < minDist) { minDist = d; closest = c.name; }
  }
  return closest || 'multicolor';
}

interface OutfitData {
  gender: string;
  items: string[];
  colorPalette: string[];
  style: string;
  description?: string;
}

interface ShoppingLink { item: string; url: string }

interface ShoppingLinks {
  byItem: Record<string, { amazon: string; myntra: string; tataCliq: string }>;
  byPlatform: {
    amazon: ShoppingLink[];
    myntra: ShoppingLink[];
    tataCliq: ShoppingLink[];
  };
}

/**
 * Drop-in replacement for the old shopping-link-generator's `generateShoppingLinks`.
 * Used by the /api/recommend route.
 */
export function generateShoppingLinks(outfit: OutfitData): ShoppingLinks {
  const result: ShoppingLinks = {
    byItem: {},
    byPlatform: { amazon: [], myntra: [], tataCliq: [] },
  };

  // Resolve the primary color name from the hex palette
  const primaryColorName = outfit.colorPalette[0]
    ? hexToColorName(outfit.colorPalette[0])
    : null;

  const gender = outfit.gender;
  const itemsToProcess = outfit.items.slice(0, 2);

  for (const rawItem of itemsToProcess) {
    // Parse the item text
    const parsed = parseItemDescription(rawItem);

    // If the item text didn't contain a color but we have a hex palette, inject it
    if (!parsed.color && primaryColorName) {
      parsed.color = primaryColorName;
    }

    // Build queries using deterministic keyword ordering:
    //   [COLOR] → [MATERIAL] → [PRODUCT_TYPE] → [GENDER]
    const queryWithGender = buildOptimizedQuery(parsed, { gender, includeMaterial: true });
    const queryNoGender = buildOptimizedQuery(parsed, { includeMaterial: true });

    const amazonUrl = buildAmazonUrl(queryWithGender);
    const myntraUrl = buildMyntraUrl(queryWithGender);
    const tataCliqUrl = buildTataCliqUrl(queryNoGender);

    result.byItem[rawItem] = { amazon: amazonUrl, myntra: myntraUrl, tataCliq: tataCliqUrl };
    result.byPlatform.amazon.push({ item: rawItem, url: amazonUrl });
    result.byPlatform.myntra.push({ item: rawItem, url: myntraUrl });
    result.byPlatform.tataCliq.push({ item: rawItem, url: tataCliqUrl });
  }

  return result;
}

/**
 * Validate all URLs in a ShoppingLinks object (used by recommend route).
 */
export function validateShoppingLinks(links: ShoppingLinks): boolean {
  try {
    for (const platform of ['amazon', 'myntra', 'tataCliq'] as const) {
      for (const link of links.byPlatform[platform]) {
        new URL(link.url);
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Fallback links when generation fails entirely.
 */
export function getFallbackLinks(gender: string, items: string[]): ShoppingLinks {
  const primaryItem = items[0] || 'clothing';
  const g = gender.toLowerCase().includes('women') ? 'women' : 'men';
  const fallbackQuery = `${g} ${primaryItem}`;

  return {
    byItem: {
      [primaryItem]: {
        amazon: buildAmazonUrl(fallbackQuery),
        myntra: buildMyntraUrl(fallbackQuery),
        tataCliq: buildTataCliqUrl(fallbackQuery),
      },
    },
    byPlatform: {
      amazon: [{ item: primaryItem, url: buildAmazonUrl(fallbackQuery) }],
      myntra: [{ item: primaryItem, url: buildMyntraUrl(fallbackQuery) }],
      tataCliq: [{ item: primaryItem, url: buildTataCliqUrl(fallbackQuery) }],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPAT — replaces calculateColorMatchScore from shopping-query-builder
// (used by tavily.ts for relevance scoring)
// ═══════════════════════════════════════════════════════════════════════════════

const COLOR_SYNONYMS: Record<string, string[]> = {
  'navy blue': ['navy', 'dark blue', 'midnight blue'],
  'sky blue': ['light blue', 'baby blue', 'powder blue'],
  'burgundy': ['wine', 'maroon', 'deep red'],
  'coral': ['peach', 'salmon'],
  'olive': ['army green', 'khaki green'],
  'cream': ['ivory', 'off white', 'off-white'],
  'charcoal': ['dark grey', 'slate grey'],
  'tan': ['beige', 'camel', 'sand'],
  'mustard': ['golden yellow', 'ochre'],
  'lavender': ['lilac', 'light purple', 'mauve'],
  'teal': ['dark cyan', 'blue green'],
};

export function getColorSynonyms(color: string): string[] {
  const lower = color.toLowerCase();
  if (COLOR_SYNONYMS[lower]) return COLOR_SYNONYMS[lower];
  for (const [key, syns] of Object.entries(COLOR_SYNONYMS)) {
    if (syns.includes(lower)) return [key, ...syns];
  }
  return lower.split(/\s+/).length > 1 ? lower.split(/\s+/) : [lower];
}

export function calculateColorMatchScore(targetColor: string, resultText: string): number {
  const lower = resultText.toLowerCase();
  const target = targetColor.toLowerCase();

  if (lower.includes(target)) return 1.0;

  const synonyms = getColorSynonyms(targetColor);
  for (const s of synonyms) {
    if (lower.includes(s.toLowerCase())) return 0.8;
  }

  const targetWords = target.split(/\s+/);
  const matched = targetWords.filter(w => lower.includes(w));
  if (matched.length > 0) return 0.5 * (matched.length / targetWords.length);

  return 0.0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPAT — replaces buildShoppingQueries from shopping-query-builder
// (used by tavily.ts structured search)
// ═══════════════════════════════════════════════════════════════════════════════

interface StructuredClothingItem {
  itemNumber: number;
  type: string;
  gender: string;
  category: string;
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

interface StructuredAnalysisInput {
  items: StructuredClothingItem[];
  overallStyle: string;
  colorHarmony: string;
  targetDemographic: string;
}

interface PlatformQueries {
  amazon: string[];
  myntra: string[];
  tatacliq: string[];
}

/**
 * Build platform-specific queries from a StructuredAnalysis (ClothingItem[]).
 * Drop-in replacement for shopping-query-builder's buildShoppingQueries.
 *
 * Uses the same deterministic [COLOR] → [MATERIAL] → [PRODUCT_TYPE] → [GENDER] ordering.
 */
export function buildShoppingQueries(structuredData: StructuredAnalysisInput): PlatformQueries {
  const amazon: string[] = [];
  const myntra: string[] = [];
  const tatacliq: string[] = [];

  for (const item of structuredData.items) {
    // Build a ParsedItem from the structured data (no string parsing needed)
    const parsed: ParsedItem = {
      productType: PRODUCT_TYPE_MAP[item.type.toLowerCase()] || item.type.toLowerCase(),
      color: item.color && !item.color.includes('#') ? item.color.toLowerCase() : null,
      material: item.fabric ? item.fabric.toLowerCase() : null,
      descriptor: item.fit && !['regular', 'regular-fit', 'standard'].includes(item.fit.toLowerCase())
        ? item.fit.toLowerCase()
        : null,
      raw: `${item.color} ${item.fabric || ''} ${item.type}`.trim(),
    };

    const gender = item.gender?.toLowerCase() === 'female' ? 'women'
      : item.gender?.toLowerCase() === 'male' ? 'men'
      : undefined;

    // Amazon + Myntra: gender in query
    const queryWithGender = buildOptimizedQuery(parsed, { gender, includeMaterial: true });
    // Tata CLiQ: gender-neutral
    const queryNoGender = buildOptimizedQuery(parsed, { includeMaterial: true });

    amazon.push(queryWithGender);
    myntra.push(queryWithGender);
    tatacliq.push(queryNoGender);
  }

  return { amazon, myntra, tatacliq };
}
