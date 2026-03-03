/**
 * Extract color names from text descriptions and convert to hex values
 */

interface ColorMapping {
  names: string[];
  hex: string;
  category: 'primary' | 'neutral' | 'pastel' | 'dark';
}

// Sort multi-word names first so "hunter green" matches before "green"
const COLOR_MAPPINGS: ColorMapping[] = [
  // Multi-word entries first (more specific matches take priority)
  { names: ['burnt orange', 'terracotta'], hex: '#B7410E', category: 'dark' },
  { names: ['hunter green', 'forest green'], hex: '#556B2F', category: 'dark' },
  { names: ['dark blue', 'midnight blue'], hex: '#000080', category: 'dark' },
  { names: ['light blue', 'sky blue', 'baby blue', 'powder blue'], hex: '#87CEEB', category: 'pastel' },
  { names: ['royal blue'], hex: '#4169E1', category: 'primary' },
  { names: ['off-white', 'eggshell'], hex: '#FAF9F6', category: 'neutral' },
  { names: ['metallic gold'], hex: '#FFD700', category: 'primary' },
  { names: ['metallic silver'], hex: '#C0C0C0', category: 'neutral' },

  // Reds
  { names: ['red', 'crimson', 'scarlet', 'ruby', 'burgundy', 'maroon', 'cherry'], hex: '#DC143C', category: 'primary' },
  { names: ['pink', 'rose', 'blush', 'salmon', 'coral', 'fuchsia', 'magenta'], hex: '#FF69B4', category: 'pastel' },
  { names: ['wine', 'bordeaux'], hex: '#722F37', category: 'dark' },

  // Oranges
  { names: ['orange', 'tangerine', 'apricot', 'peach'], hex: '#FF8C00', category: 'primary' },
  { names: ['rust', 'copper'], hex: '#B7410E', category: 'dark' },

  // Yellows
  { names: ['yellow', 'golden', 'gold', 'mustard', 'amber'], hex: '#FFD700', category: 'primary' },
  { names: ['lemon', 'canary'], hex: '#FFFF00', category: 'primary' },
  { names: ['cream', 'ivory', 'beige', 'tan', 'khaki'], hex: '#F5DEB3', category: 'neutral' },

  // Greens
  { names: ['green', 'emerald', 'jade', 'lime', 'mint', 'sage'], hex: '#228B22', category: 'primary' },
  { names: ['olive', 'forest', 'moss'], hex: '#556B2F', category: 'dark' },
  { names: ['teal', 'turquoise', 'aqua', 'cyan'], hex: '#008B8B', category: 'primary' },

  // Blues
  { names: ['blue', 'azure', 'cerulean', 'sapphire', 'cobalt'], hex: '#0000FF', category: 'primary' },
  { names: ['navy', 'midnight'], hex: '#000080', category: 'dark' },
  { names: ['sky'], hex: '#87CEEB', category: 'pastel' },
  { names: ['indigo'], hex: '#4B0082', category: 'dark' },

  // Purples
  { names: ['purple', 'violet', 'lavender', 'lilac', 'plum', 'mauve'], hex: '#800080', category: 'primary' },
  { names: ['orchid', 'amethyst'], hex: '#DA70D6', category: 'pastel' },

  // Browns
  { names: ['brown', 'chocolate', 'coffee', 'mocha', 'chestnut'], hex: '#8B4513', category: 'dark' },
  { names: ['camel', 'taupe', 'sand'], hex: '#C19A6B', category: 'neutral' },

  // Neutrals
  { names: ['white'], hex: '#FFFFFF', category: 'neutral' },
  { names: ['black', 'jet', 'ebony'], hex: '#000000', category: 'neutral' },
  { names: ['gray', 'grey', 'charcoal', 'slate'], hex: '#808080', category: 'neutral' },
  { names: ['silver'], hex: '#C0C0C0', category: 'neutral' },

  // Metallics
  { names: ['bronze', 'brass'], hex: '#CD7F32', category: 'dark' },
];

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const GRAY_FALLBACK = ['#808080', '#A0A0A0'];

/**
 * Extract color names from a text description
 */
export function extractColorsFromDescription(description: string): string[] {
  if (!description || description.trim().length === 0) {
    return GRAY_FALLBACK;
  }

  const lowerDesc = description.toLowerCase();
  const extractedColors: string[] = [];
  const matchedHexes = new Set<string>();
  // Track which character ranges have already matched to avoid double-matching
  const matchedRanges: Array<[number, number]> = [];

  const isRangeOverlapping = (start: number, end: number) =>
    matchedRanges.some(([s, e]) => start < e && end > s);

  for (const colorMapping of COLOR_MAPPINGS) {
    for (const colorName of colorMapping.names) {
      const regex = new RegExp(`\\b${escapeRegex(colorName)}\\b`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(lowerDesc)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        if (!isRangeOverlapping(start, end) && !matchedHexes.has(colorMapping.hex)) {
          extractedColors.push(colorMapping.hex);
          matchedHexes.add(colorMapping.hex);
          matchedRanges.push([start, end]);
          break; // One match per mapping is enough
        }
      }
    }
  }

  if (extractedColors.length === 0) {
    return GRAY_FALLBACK;
  }

  return extractedColors.slice(0, 5);
}

/**
 * Check if description contains color information
 */
export function hasColorInformation(description: string): boolean {
  if (!description || description.trim().length === 0) {
    return false;
  }

  const colors = extractColorsFromDescription(description);
  // Return true if we got actual colors (not just the gray fallback)
  return colors.length > 0 && !(colors.length === 2 && colors[0] === '#808080' && colors[1] === '#A0A0A0');
}
