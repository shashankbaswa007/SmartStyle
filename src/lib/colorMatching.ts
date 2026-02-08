/**
 * Client-side Color Matching Utility
 * Handles all color harmony generation, contrast calculation, and palette logic
 * No server dependency - fully offline-capable
 */

import chroma from 'chroma-js';

export interface ColorMatch {
  label: string;
  hex: string;
  rgb: string;
  name?: string;
  fashionContext?: {
    usage: 'primary' | 'secondary' | 'accent';
    ratio: string;
    clothingItems: string[];
    styleNotes: string;
  };
}

export interface ColorResponse {
  inputColor: {
    hex: string;
    rgb: string;
    name: string;
    fashionContext?: {
      usage: 'primary' | 'secondary' | 'accent';
      ratio: string;
      clothingItems: string[];
      styleNotes: string;
    };
  };
  matches: ColorMatch[];
  harmonyType: string;
  explanation?: {
    why: string;
    howToUse: string;
    colorPersonality: string;
    fashionTips: string[];
  };
}

// Expanded color database with fashion-specific colors (140+ colors)
export const FASHION_COLORS: Record<string, string> = {
  // Basic colors
  'red': '#FF0000',
  'blue': '#0000FF',
  'green': '#00FF00',
  'yellow': '#FFFF00',
  'black': '#000000',
  'white': '#FFFFFF',
  
  // Popular fashion colors (including turquoise, chartreuse, etc.)
  'turquoise': '#40E0D0',
  'aqua': '#00FFFF',
  'teal': '#008080',
  'chartreuse': '#7FFF00',
  'periwinkle': '#CCCCFF',
  'mauve': '#E0B0FF',
  'burgundy': '#800020',
  'maroon': '#800000',
  'coral': '#FF7F50',
  'salmon': '#FA8072',
  'peach': '#FFE5B4',
  'mint': '#98FF98',
  'sage': '#9DC183',
  'olive': '#808000',
  'khaki': '#C3B091',
  'tan': '#D2B48C',
  'beige': '#F5F5DC',
  'cream': '#FFFDD0',
  'ivory': '#FFFFF0',
  'champagne': '#F7E7CE',
  'blush': '#DE5D83',
  'rose': '#FF007F',
  'fuchsia': '#FF00FF',
  'magenta': '#FF00FF',
  'lilac': '#C8A2C8',
  'lavender': '#E6E6FA',
  'plum': '#DDA0DD',
  'violet': '#EE82EE',
  'indigo': '#4B0082',
  'navy': '#000080',
  'cobalt': '#0047AB',
  'azure': '#007FFF',
  'sky blue': '#87CEEB',
  'powder blue': '#B0E0E6',
  'steel blue': '#4682B4',
  'slate': '#708090',
  'charcoal': '#36454F',
  'graphite': '#383428',
  'pewter': '#96A8A1',
  'silver': '#C0C0C0',
  'gold': '#FFD700',
  'bronze': '#CD7F32',
  'copper': '#B87333',
  'rust': '#B7410E',
  'terracotta': '#E2725B',
  'sienna': '#A0522D',
  'umber': '#635147',
  'ochre': '#CC7722',
  'mustard': '#FFDB58',
  'canary': '#FFFF99',
  'lemon': '#FFF44F',
  'lime': '#BFFF00',
  'emerald': '#50C878',
  'jade': '#00A86B',
  'forest green': '#228B22',
  'hunter green': '#355E3B',
  'pine': '#01796F',
  'moss': '#8A9A5B',
  'seafoam': '#93E9BE',
  'celadon': '#ACE1AF',
  'pistachio': '#93C572',
  'avocado': '#568203',
  
  // Neutrals & Earth Tones
  'taupe': '#483C32',
  'mushroom': '#ADA397',
  'sand': '#C2B280',
  'wheat': '#F5DEB3',
  'camel': '#C19A6B',
  'cognac': '#9A463D',
  'chocolate': '#7B3F00',
  'coffee': '#6F4E37',
  'espresso': '#4E312D',
  'mocha': '#967969',
  
  // Jewel Tones
  'ruby': '#E0115F',
  'sapphire': '#0F52BA',
  'amethyst': '#9966CC',
  'topaz': '#FFC87C',
  'citrine': '#E4D00A',
  'garnet': '#733635',
  'onyx': '#353839',
  'pearl': '#EAE0C8',
  'opal': '#A8C3BC',
  
  // Pastels
  'baby blue': '#89CFF0',
  'baby pink': '#F4C2C2',
  'mint green': '#98FF98',
  'lemon chiffon': '#FFFACD',
  'peach puff': '#FFDAB9',
  'misty rose': '#FFE4E1',
  'alice blue': '#F0F8FF',
  'honeydew': '#F0FFF0',
  'seashell': '#FFF5EE',
  
  // Grays & Whites
  'ash': '#B2BEB5',
  'dove': '#D3D3D3',
  'smoke': '#738276',
  'fog': '#DCDCDC',
  'cloud': '#F5F5F5',
  'snow': '#FFFAFA',
  'alabaster': '#F2F0E6',
  'porcelain': '#F4EDE4',
  
  // Additional Fashion Colors
  'pink': '#FFC0CB',
  'hot pink': '#FF69B4',
  'deep pink': '#FF1493',
  'light pink': '#FFB6C1',
  'crimson': '#DC143C',
  'scarlet': '#FF2400',
  'vermillion': '#E34234',
  'orange': '#FFA500',
  'tangerine': '#F28500',
  'apricot': '#FBCEB1',
  'amber': '#FFBF00',
  'honey': '#EB9605',
  'butterscotch': '#E39842',
  'caramel': '#AF6E4D',
  'cinnamon': '#D2691E',
  'mahogany': '#C04000',
  'chestnut': '#954535',
  'purple': '#800080',
  'orchid': '#DA70D6',
  'thistle': '#D8BFD8',
  'heather': '#B7A8C7',
  'wisteria': '#C9A0DC',
  'periwinkle blue': '#8E82FE',
  'cornflower': '#6495ED',
  'royal blue': '#4169E1',
  'midnight blue': '#191970',
  'denim': '#1560BD',
  'cerulean': '#007BA7',
  'aquamarine': '#7FFFD4',
  'cyan': '#00FFFF',
};

// Color harmony calculation functions
const HARMONY_TYPES = {
  complementary: (hue: number) => [(hue + 180) % 360],
  analogous: (hue: number) => [(hue + 30) % 360, (hue - 30 + 360) % 360],
  triadic: (hue: number) => [(hue + 120) % 360, (hue + 240) % 360],
  split_complementary: (hue: number) => [(hue + 150) % 360, (hue + 210) % 360],
  tetradic: (hue: number) => [(hue + 90) % 360, (hue + 180) % 360, (hue + 270) % 360],
  monochromatic: (hue: number) => [hue], // Same hue, different saturation/lightness
};

// Helper to check if two colors have good contrast (WCAG AA standard)
export const hasGoodContrast = (color1: chroma.Color, color2: chroma.Color): boolean => {
  const luminance1 = color1.luminance();
  const luminance2 = color2.luminance();
  const contrast = luminance1 > luminance2
    ? (luminance1 + 0.05) / (luminance2 + 0.05)
    : (luminance2 + 0.05) / (luminance1 + 0.05);
  return contrast >= 3; // At least 3:1 ratio for fashion (less strict than text)
};

// Helper function to ensure fashionable colors (not too dark or too light)
const adjustForFashion = (color: chroma.Color): chroma.Color => {
  const [h, s, l] = color.hsl();
  // Ensure saturation is at least 0.2 (20%) for vibrant colors
  const adjustedS = Math.max(0.2, Math.min(0.9, s));
  // Ensure lightness is between 0.25 and 0.85 for wearable colors
  const adjustedL = Math.max(0.25, Math.min(0.85, l));
  return chroma.hsl(h || 0, adjustedS, adjustedL);
};

// Add shade variation helper
const addShadeVariation = (
  baseColor: chroma.Color, 
  adjustment: number, 
  label: string
): ColorMatch => {
  let variantColor: chroma.Color;
  
  if (adjustment > 0) {
    // Lighter shade - increase lightness while maintaining hue
    variantColor = baseColor.brighten(adjustment * 1.5);
  } else {
    // Darker shade - decrease lightness while maintaining hue
    variantColor = baseColor.darken(Math.abs(adjustment) * 1.5);
  }
  
  // Ensure the color stays fashionable
  const [h, s, l] = variantColor.hsl();
  const adjustedL = Math.max(0.2, Math.min(0.9, l));
  variantColor = chroma.hsl(h || 0, Math.max(0.2, s), adjustedL);
  
  // Find closest named color
  let bestMatch = { name: 'Unknown', hex: variantColor.hex(), distance: Infinity };
  Object.entries(FASHION_COLORS).forEach(([name, hex]) => {
    const distance = chroma.deltaE(variantColor, chroma(hex));
    if (distance < bestMatch.distance) {
      bestMatch = { name, hex, distance };
    }
  });
  
  const finalHex = bestMatch.distance < 35 ? bestMatch.hex : variantColor.hex();
  const finalColor = chroma(finalHex);
  
  return {
    label,
    hex: finalHex,
    rgb: finalColor.css(),
    name: bestMatch.distance < 35 
      ? bestMatch.name.charAt(0).toUpperCase() + bestMatch.name.slice(1)
      : label,
  };
};

/**
 * Generate explanation for why this palette was created
 */
function generatePaletteExplanation(
  color: chroma.Color,
  harmonyType: string,
  wasRecommended: boolean
): {
  why: string;
  howToUse: string;
  colorPersonality: string;
  fashionTips: string[];
} {
  const [h, s, l] = color.hsl();
  const hue = h || 0;
  
  // Determine color temperature
  const isWarm = (hue >= 0 && hue < 60) || (hue >= 300 && hue <= 360);
  const isCool = hue >= 180 && hue < 300;
  
  // Determine color characteristics
  const isVibrant = s > 0.6;
  const isPastel = s < 0.4 && l > 0.6;
  const isDark = l < 0.3;
  const isLight = l > 0.75;
  const isMuted = s < 0.3;
  
  // Color personality
  let colorPersonality = '';
  if (isVibrant && isWarm) {
    colorPersonality = 'This energetic warm color demands attention and brings confidence to any outfit.';
  } else if (isVibrant && isCool) {
    colorPersonality = 'This bold cool color creates a striking, modern look that stands out.';
  } else if (isPastel) {
    colorPersonality = 'This soft pastel color offers a gentle, approachable aesthetic perfect for subtle elegance.';
  } else if (isMuted) {
    colorPersonality = 'This understated color provides sophistication and versatility for everyday wear.';
  } else if (isDark) {
    colorPersonality = 'This deep color adds drama and refinement, ideal for formal or evening looks.';
  } else if (isLight) {
    colorPersonality = 'This airy light color creates an open, fresh feeling that works well in warmer seasons.';
  } else {
    colorPersonality = 'This balanced color offers versatility and works well across multiple styles.';
  }
  
  // Why explanation based on harmony type
  let why = '';
  switch (harmonyType) {
    case 'complementary':
      why = `We chose colors opposite on the color wheel to create maximum contrast. ${isVibrant ? 'Your vibrant base color pairs beautifully with its opposite for bold, eye-catching combinations.' : 'This creates dynamic tension while maintaining visual balance.'}`;
      break;
    case 'analogous':
      why = `We selected colors adjacent to yours on the wheel for a naturally harmonious flow. ${isWarm ? 'These warm neighbors blend seamlessly for cohesive, comfortable looks.' : isCool ? 'These cool neighbors create a serene, sophisticated palette.' : 'These related colors work together effortlessly.'}`;
      break;
    case 'triadic':
      why = `We picked colors evenly spaced around the wheel for vibrant balance. ${isVibrant ? 'Your bold starting point leads to an equally confident palette.' : 'This creates visual interest while maintaining equilibrium.'}`;
      break;
    case 'split_complementary':
      why = `We chose your opposite's neighbors instead of the direct opposite for softer contrast. ${s > 0.5 ? 'This tames the intensity while keeping the excitement.' : 'This provides interest without overwhelming the eye.'}`;
      break;
    case 'tetradic':
      why = `We selected two complementary pairs for a rich, complex palette. ${isVibrant ? 'Your vivid base unlocks a world of bold combinations.' : 'This offers maximum variety and creative flexibility.'}`;
      break;
    case 'monochromatic':
      why = `We created variations of your color using different shades and tints. ${isDark ? 'Your deep base provides drama with lighter accents for contrast.' : isLight ? 'Your light base creates airiness with darker tones for definition.' : 'This builds a cohesive, elegant single-color story.'}`;
      break;
    default:
      why = 'We selected colors that naturally harmonize with your choice, creating a balanced and wearable palette.';
  }
  
  // Add recommended context
  if (wasRecommended) {
    const reasons = [];
    if (s < 0.3) reasons.push('low saturation works best with analogous colors');
    if (l > 0.75) reasons.push('light colors benefit from complementary contrast');
    if (l < 0.3) reasons.push('dark colors shine with split complementary schemes');
    if (s > 0.6) reasons.push('vibrant colors excel in triadic harmonies');
    
    if (reasons.length > 0) {
      why += ` Our smart algorithm detected that ${reasons[0]}, so we automatically chose ${harmonyType.replace('_', ' ')} harmony.`;
    }
  }
  
  // How to use
  let howToUse = '';
  if (isVibrant) {
    howToUse = 'Use your bold base color as the 60% main element. The matching colors work best as 30% secondary pieces or 10% accessories to avoid overwhelming the eye.';
  } else if (isPastel) {
    howToUse = 'These soft colors can be mixed freely in larger proportions. Try pairing 60% of one pastel with 40% of another for a dreamy, cohesive look.';
  } else if (isDark) {
    howToUse = 'Start with dark colors as 60% of your outfit, then lighten up with 30% mid-tones and 10% bright accents to create depth and dimension.';
  } else if (isMuted) {
    howToUse = 'These versatile neutrals work beautifully in any proportion. Mix them freely or use one as a canvas (70%) for colorful accessories (30%).';
  } else {
    howToUse = 'Follow the classic 60-30-10 rule: 60% dominant color, 30% secondary color, and 10% accent color for balanced, professional looks.';
  }
  
  // Fashion tips
  const fashionTips: string[] = [];
  
  if (isWarm) {
    fashionTips.push('Warm colors like these are perfect for fall/winter wardrobes and create inviting, energetic vibes');
    if (harmonyType === 'complementary') {
      fashionTips.push('Pair warm with cool accents to make both colors pop dramatically');
    }
  } else if (isCool) {
    fashionTips.push('Cool colors excel in spring/summer and project calm confidence and professionalism');
    if (harmonyType === 'analogous') {
      fashionTips.push('Keep your cool palette cohesive for a sleek, modern aesthetic');
    }
  }
  
  if (isVibrant && !isDark) {
    fashionTips.push('Bold colors work best in smaller doses—think statement jackets, shoes, or bags rather than full outfits');
  }
  
  if (isPastel) {
    fashionTips.push('Pastel palettes are naturally romantic—perfect for daytime events, brunches, or spring occasions');
  }
  
  if (isMuted || s < 0.4) {
    fashionTips.push('These muted tones are wardrobe workhorses—mix them endlessly without worry');
  }
  
  if (harmonyType === 'monochromatic') {
    fashionTips.push('Monochromatic looks appear effortlessly elegant—vary textures (silk, knit, leather) to add visual interest');
  }
  
  if (harmonyType === 'complementary' || harmonyType === 'split_complementary') {
    fashionTips.push('High contrast outfits make powerful statements—save these combinations for when you want to be noticed');
  }
  
  // Always include one practical tip
  fashionTips.push('Try pairing these colors with denim or white as a neutral bridge between bolder combinations');
  
  return {
    why,
    howToUse,
    colorPersonality,
    fashionTips: fashionTips.slice(0, 3), // Keep to 3 tips maximum
  };
}

/**
 * Deterministic recommended harmony selection based on color characteristics.
 * Uses saturation and lightness to pick the most fashion-appropriate harmony.
 */
export function getRecommendedHarmony(color: chroma.Color): string {
  const [h, s, l] = color.hsl();

  // Very low saturation (neutrals/grays) — analogous keeps it cohesive
  if (s < 0.15) return 'analogous';

  // Dark colors — split complementary adds interest without overwhelming
  if (l < 0.3) return 'split_complementary';

  // Light/pastel colors — complementary provides needed contrast
  if (l > 0.75) return 'complementary';

  // Highly saturated — triadic balances vibrancy across the wheel
  if (s > 0.7) return 'triadic';

  // Muted mid-tones — analogous for smooth, easy-to-wear palettes
  if (s < 0.4) return 'analogous';

  // Default for mid-range colors — complementary is most universally useful
  return 'complementary';
}

/**
 * Generate fashion context for a color based on its role in the palette
 */
function generateFashionContext(
  color: chroma.Color,
  usage: 'primary' | 'secondary' | 'accent',
  harmonyType: string
): ColorMatch['fashionContext'] {
  const [h, s, l] = color.hsl();
  const hue = h || 0;

  // Determine ratio based on usage role
  const ratios: Record<string, string> = {
    primary: '60% of outfit',
    secondary: '30% of outfit',
    accent: '10% accent',
  };

  // Determine suitable clothing items based on color properties and role
  const clothingItems: string[] = [];
  if (usage === 'primary') {
    if (l < 0.35) clothingItems.push('Blazer', 'Trousers', 'Coat');
    else if (l > 0.7) clothingItems.push('Shirt', 'Blouse', 'Dress');
    else clothingItems.push('Jacket', 'Sweater', 'Skirt');
  } else if (usage === 'secondary') {
    clothingItems.push('Top', 'Cardigan', 'Scarf');
  } else {
    if (s > 0.5) clothingItems.push('Belt', 'Bag', 'Shoes');
    else clothingItems.push('Watch', 'Jewelry', 'Hat');
  }

  // Style notes based on color personality
  let styleNotes = '';
  const isWarm = (hue >= 0 && hue < 70) || hue >= 300;
  if (usage === 'primary') {
    styleNotes = isWarm
      ? 'Warm foundation — pairs naturally with earth tones'
      : 'Cool foundation — complements silver and white accessories';
  } else if (usage === 'secondary') {
    styleNotes = s > 0.5
      ? 'Adds visual energy as a supporting color'
      : 'Smooth transition between main and accent colors';
  } else {
    styleNotes = s > 0.5
      ? 'Small pops of this color draw the eye to key details'
      : 'Subtle accent that ties the look together';
  }

  return {
    usage,
    ratio: ratios[usage],
    clothingItems,
    styleNotes,
  };
}

/**
 * Main function to generate color matches based on color theory
 * @param color - Color name, hex code, or RGB value
 * @param harmonyType - Type of color harmony to generate
 * @returns ColorResponse object with matched colors
 * @throws Error if color format is invalid
 */
export function generateColorMatches(
  color: string,
  harmonyType: string = 'complementary'
): ColorResponse {
  if (!color || typeof color !== 'string') {
    throw new Error('Valid color name, hex code, or RGB value is required');
  }

  // Validate and parse the input color
  let inputColorObj: chroma.Color;
  try {
    inputColorObj = chroma(color);
  } catch (error) {
    throw new Error('Invalid color format. Use hex (#FF0000), RGB (rgb(255,0,0)), or color name (turquoise, chartreuse, etc.)');
  }

  const inputHex = inputColorObj.hex();
  const inputRgb = inputColorObj.css();
  const [h, s, l] = inputColorObj.hsl();
  const inputHue = h || 0;

  // Handle "recommended" by deterministically selecting the best harmony
  let wasRecommended = false;
  let resolvedHarmonyType = harmonyType;
  if (harmonyType === 'recommended') {
    resolvedHarmonyType = getRecommendedHarmony(inputColorObj);
    wasRecommended = true;
  }

  // Validate the harmony type exists
  if (!(resolvedHarmonyType in HARMONY_TYPES)) {
    resolvedHarmonyType = 'complementary';
  }

  // Find the closest named color from our expanded database
  let closestColorName = 'Custom Color';
  let minDistance = Infinity;

  Object.entries(FASHION_COLORS).forEach(([name, hex]) => {
    const distance = chroma.deltaE(inputColorObj, chroma(hex));
    if (distance < minDistance) {
      minDistance = distance;
      closestColorName = name;
    }
  });

  // Generate harmonious colors based on color theory
  const harmonyHues = HARMONY_TYPES[resolvedHarmonyType as keyof typeof HARMONY_TYPES](inputHue);
  
  const matches: ColorMatch[] = harmonyHues.map((targetHue, index) => {
    // Create harmonious color with adjusted saturation and lightness for better fashion appeal
    let harmonyColor: chroma.Color;
    
    if (resolvedHarmonyType === 'monochromatic') {
      // For monochromatic, use same hue with varied lightness
      const lightnessVariations = [0.3, 0.4, 0.6, 0.7];
      harmonyColor = chroma.hsl(inputHue, Math.max(0.3, s), lightnessVariations[index % lightnessVariations.length]);
    } else if (resolvedHarmonyType === 'analogous') {
      // For analogous, keep similar saturation and lightness
      harmonyColor = chroma.hsl(targetHue, s * 0.9, l);
    } else if (resolvedHarmonyType === 'complementary') {
      // For complementary, slightly adjust saturation for balance
      harmonyColor = chroma.hsl(targetHue, s * 0.85, l);
    } else {
      // For other harmonies, maintain similar saturation
      harmonyColor = chroma.hsl(targetHue, s, l);
    }
    
    // Ensure the color is fashionable (not too extreme)
    harmonyColor = adjustForFashion(harmonyColor);
    
    // Find closest named color for this harmony color with stricter matching
    let bestMatch = { name: 'Unknown', hex: harmonyColor.hex(), distance: Infinity };
    
    Object.entries(FASHION_COLORS).forEach(([name, hex]) => {
      const distance = chroma.deltaE(harmonyColor, chroma(hex));
      if (distance < bestMatch.distance) {
        bestMatch = { name, hex, distance };
      }
    });
    
    // If the match is too far (deltaE > 40), use the generated color instead
    const finalHex = bestMatch.distance < 40 ? bestMatch.hex : harmonyColor.hex();
    const finalColor = chroma(finalHex);

    // Assign fashion context: first match is secondary, rest are accents
    const usage: 'primary' | 'secondary' | 'accent' = index === 0 ? 'secondary' : 'accent';

    return {
      label: resolvedHarmonyType === 'complementary' && index === 0 
        ? 'Complementary' 
        : resolvedHarmonyType === 'analogous'
        ? index === 0 ? 'Analogous +30°' : 'Analogous -30°'
        : resolvedHarmonyType === 'triadic'
        ? `Triadic ${index + 1}`
        : resolvedHarmonyType === 'split_complementary'
        ? `Split Comp ${index + 1}`
        : resolvedHarmonyType === 'tetradic'
        ? `Tetradic ${index + 1}`
        : `Shade ${index + 1}`,
      hex: finalHex,
      rgb: finalColor.css(),
      name: bestMatch.distance < 40 
        ? bestMatch.name.charAt(0).toUpperCase() + bestMatch.name.slice(1)
        : 'Custom ' + (index + 1),
      fashionContext: generateFashionContext(finalColor, usage, resolvedHarmonyType),
    };
  });

  // Add lighter and darker variations
  const lighterShade = addShadeVariation(inputColorObj, 1, 'Lighter Shade');
  lighterShade.fashionContext = generateFashionContext(chroma(lighterShade.hex), 'accent', resolvedHarmonyType);
  matches.push(lighterShade);

  const darkerShade = addShadeVariation(inputColorObj, -1, 'Darker Shade');
  darkerShade.fashionContext = generateFashionContext(chroma(darkerShade.hex), 'accent', resolvedHarmonyType);
  matches.push(darkerShade);
  
  // Add a tint and shade for more variety
  if (matches.length < 10) {
    const lightTint = addShadeVariation(inputColorObj, 0.5, 'Light Tint');
    lightTint.fashionContext = generateFashionContext(chroma(lightTint.hex), 'accent', resolvedHarmonyType);
    matches.push(lightTint);
  }
  if (matches.length < 10) {
    const darkTone = addShadeVariation(inputColorObj, -0.5, 'Dark Tone');
    darkTone.fashionContext = generateFashionContext(chroma(darkTone.hex), 'accent', resolvedHarmonyType);
    matches.push(darkTone);
  }

  // Generate fashion context for the input color (it's the primary)
  const inputFashionContext = generateFashionContext(inputColorObj, 'primary', resolvedHarmonyType);

  // Generate explanation
  const explanation = generatePaletteExplanation(inputColorObj, resolvedHarmonyType, wasRecommended);

  return {
    inputColor: {
      hex: inputHex,
      rgb: inputRgb,
      name: closestColorName.charAt(0).toUpperCase() + closestColorName.slice(1),
      fashionContext: inputFashionContext,
    },
    matches,
    harmonyType: resolvedHarmonyType,
    explanation,
    ...(wasRecommended ? { isRecommended: true } : {}),
  } as ColorResponse;
}
