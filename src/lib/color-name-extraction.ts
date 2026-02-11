/**
 * Extract color names from text descriptions and convert to hex values
 */

interface ColorMapping {
  names: string[];
  hex: string;
  category: 'primary' | 'neutral' | 'pastel' | 'dark';
}

const COLOR_MAPPINGS: ColorMapping[] = [
  // Reds
  { names: ['red', 'crimson', 'scarlet', 'ruby', 'burgundy', 'maroon', 'cherry'], hex: '#DC143C', category: 'primary' },
  { names: ['pink', 'rose', 'blush', 'salmon', 'coral', 'fuchsia', 'magenta'], hex: '#FF69B4', category: 'pastel' },
  { names: ['wine', 'bordeaux'], hex: '#722F37', category: 'dark' },
  
  // Oranges
  { names: ['orange', 'tangerine', 'apricot', 'peach'], hex: '#FF8C00', category: 'primary' },
  { names: ['rust', 'burnt orange', 'terracotta', 'copper'], hex: '#B7410E', category: 'dark' },
  
  // Yellows
  { names: ['yellow', 'golden', 'gold', 'mustard', 'amber'], hex: '#FFD700', category: 'primary' },
  { names: ['lemon', 'canary'], hex: '#FFFF00', category: 'primary' },
  { names: ['cream', 'ivory', 'beige', 'sand', 'tan', 'khaki'], hex: '#F5DEB3', category: 'neutral' },
  
  // Greens
  { names: ['green', 'emerald', 'jade', 'lime', 'mint', 'sage'], hex: '#228B22', category: 'primary' },
  { names: ['olive', 'forest', 'hunter green', 'moss'], hex: '#556B2F', category: 'dark' },
  { names: ['teal', 'turquoise', 'aqua', 'cyan'], hex: '#008B8B', category: 'primary' },
  
  // Blues
  { names: ['blue', 'azure', 'cerulean', 'sapphire', 'cobalt'], hex: '#0000FF', category: 'primary' },
  { names: ['navy', 'dark blue', 'midnight'], hex: '#000080', category: 'dark' },
  { names: ['light blue', 'sky', 'baby blue', 'powder blue'], hex: '#87CEEB', category: 'pastel' },
  { names: ['indigo', 'royal blue'], hex: '#4B0082', category: 'dark' },
  
  // Purples
  { names: ['purple', 'violet', 'lavender', 'lilac', 'plum', 'mauve'], hex: '#800080', category: 'primary' },
  { names: ['orchid', 'amethyst'], hex: '#DA70D6', category: 'pastel' },
  
  // Browns
  { names: ['brown', 'chocolate', 'coffee', 'mocha', 'chestnut'], hex: '#8B4513', category: 'dark' },
  { names: ['camel', 'taupe', 'sand'], hex: '#C19A6B', category: 'neutral' },
  
  // Neutrals
  { names: ['white', 'off-white', 'eggshell'], hex: '#FFFFFF', category: 'neutral' },
  { names: ['black', 'jet', 'ebony'], hex: '#000000', category: 'neutral' },
  { names: ['gray', 'grey', 'silver', 'charcoal', 'slate'], hex: '#808080', category: 'neutral' },
  
  // Metalics
  { names: ['gold', 'metallic gold'], hex: '#FFD700', category: 'primary' },
  { names: ['silver', 'metallic silver'], hex: '#C0C0C0', category: 'neutral' },
  { names: ['bronze', 'brass'], hex: '#CD7F32', category: 'dark' },
];

/**
 * Extract color names from a text description
 */
export function extractColorsFromDescription(description: string): string[] {
  if (!description || description.trim().length === 0) {
    return ['#808080', '#A0A0A0']; // Default gray fallback
  }

  const lowerDesc = description.toLowerCase();
  const extractedColors: string[] = [];
  const foundCategories = new Set<string>();

  // Find all color matches in the description
  for (const colorMapping of COLOR_MAPPINGS) {
    for (const colorName of colorMapping.names) {
      // Use word boundary to avoid partial matches
      const regex = new RegExp(`\\b${colorName}\\b`, 'i');
      if (regex.test(lowerDesc)) {
        // Avoid duplicate similar colors
        if (!foundCategories.has(`${colorMapping.category}-${colorMapping.hex}`)) {
          extractedColors.push(colorMapping.hex);
          foundCategories.add(`${colorMapping.category}-${colorMapping.hex}`);
        }
        break; // Stop checking other names for this mapping
      }
    }
  }

  // If no colors found, return neutral fallback
  if (extractedColors.length === 0) {
    return ['#808080', '#A0A0A0']; // Gray fallback
  }

  // Limit to max 5 colors
  return extractedColors.slice(0, 5);
}

/**
 * Get a sample of common color keywords for UI hints
 */
export function getColorKeywordSamples(): string[] {
  return [
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
    'black', 'white', 'gray', 'brown', 'navy', 'beige', 'burgundy'
  ];
}

/**
 * Check if description contains color information
 */
export function hasColorInformation(description: string): boolean {
  if (!description || description.trim().length === 0) {
    return false;
  }

  const colors = extractColorsFromDescription(description);
  // Check if we got actual colors (not just gray fallback)
  return colors.length > 0 && colors[0] !== '#808080';
}
