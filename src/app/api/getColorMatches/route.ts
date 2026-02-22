import { NextRequest, NextResponse } from 'next/server';
import chroma from 'chroma-js';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter';

interface ColorMatch {
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

// Expanded color database with fashion-specific colors (140+ colors)
const FASHION_COLORS: Record<string, string> = {
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

// Determine if a color is warm or cool
const isWarmColor = (color: chroma.Color): boolean => {
  const [h] = color.hsl();
  const hue = h || 0;
  // Warm: red to yellow (0-60 degrees)
  return (hue >= 0 && hue <= 60) || (hue >= 300 && hue <= 360);
};

// Determine clothing items based on color characteristics
const getSuggestedClothing = (color: chroma.Color, usage: string): string[] => {
  const [h, s, l] = color.hsl();
  const saturation = s || 0;
  const lightness = l || 0;
  const isWarm = isWarmColor(color);
  
  if (usage === 'primary') {
    // Primary colors - main outfit pieces
    if (lightness > 0.7) {
      return ['Light tops', 'Summer dresses', 'Casual shirts', 'Blouses'];
    } else if (lightness < 0.3) {
      return ['Pants', 'Skirts', 'Blazers', 'Coats'];
    } else if (saturation > 0.6) {
      return ['Statement pieces', 'Dresses', 'Jackets', 'Sweaters'];
    } else {
      return ['Tops', 'Shirts', 'Dresses', 'Trousers'];
    }
  } else if (usage === 'secondary') {
    // Secondary colors - complementary pieces
    if (isWarm) {
      return ['Cardigans', 'Scarves', 'Light jackets', 'Vests'];
    } else {
      return ['Blazers', 'Shawls', 'Layering pieces', 'Outer layers'];
    }
  } else {
    // Accent colors - small touches
    if (saturation > 0.7) {
      return ['Jewelry', 'Belts', 'Handbags', 'Shoes'];
    } else if (lightness > 0.6) {
      return ['Accessories', 'Scarves', 'Hair accessories', 'Light jewelry'];
    } else {
      return ['Footwear', 'Bags', 'Watches', 'Bold accessories'];
    }
  }
};

// Generate style notes based on color properties
const getStyleNotes = (color: chroma.Color, usage: string, harmonyType: string): string => {
  const [h, s, l] = color.hsl();
  const saturation = s || 0;
  const lightness = l || 0;
  
  if (usage === 'primary') {
    if (saturation > 0.7) {
      return 'Bold choice for main pieces. Balance with neutral accessories.';
    } else if (lightness > 0.75) {
      return 'Light and airy. Perfect for daytime or summer outfits.';
    } else if (lightness < 0.3) {
      return 'Deep and sophisticated. Ideal for formal or evening wear.';
    } else {
      return 'Versatile main color. Easy to style with various accessories.';
    }
  } else if (usage === 'secondary') {
    return `Complements your primary color through ${harmonyType} harmony. Use for layering.`;
  } else {
    if (saturation > 0.7) {
      return 'Vibrant accent. Use sparingly for maximum impact.';
    } else {
      return 'Subtle accent. Adds depth without overwhelming.';
    }
  }
};

// Smart harmony recommendation based on color characteristics
const getRecommendedHarmony = (color: chroma.Color): keyof typeof HARMONY_TYPES => {
  const [h, s, l] = color.hsl();
  const saturation = s || 0;
  const lightness = l || 0;
  
  // Low saturation (neutral/pastel colors) - analogous for soft harmony
  if (saturation < 0.3) {
    return 'analogous';
  }
  
  // Very light colors (pastels) - complementary for contrast
  if (lightness > 0.75) {
    return 'complementary';
  }
  
  // Very dark colors - split complementary for richness without overwhelming
  if (lightness < 0.3) {
    return 'split_complementary';
  }
  
  // Medium saturation, medium lightness (most fashion colors)
  // High saturation - triadic for vibrant balanced looks
  if (saturation > 0.6) {
    return 'triadic';
  }
  
  // Default: complementary for bold statement pieces
  return 'complementary';
};

// Color harmony calculation functions with improved angles for better results
const HARMONY_TYPES = {
  complementary: (hue: number) => [(hue + 180) % 360],
  analogous: (hue: number) => [(hue + 30) % 360, (hue - 30 + 360) % 360],
  triadic: (hue: number) => [(hue + 120) % 360, (hue + 240) % 360],
  split_complementary: (hue: number) => [(hue + 150) % 360, (hue + 210) % 360],
  tetradic: (hue: number) => [(hue + 90) % 360, (hue + 180) % 360, (hue + 270) % 360],
  monochromatic: (hue: number) => [hue], // Same hue, different saturation/lightness
};

// Helper to check if two colors have good contrast (WCAG AA standard)
const hasGoodContrast = (color1: chroma.Color, color2: chroma.Color): boolean => {
  const luminance1 = color1.luminance();
  const luminance2 = color2.luminance();
  const contrast = luminance1 > luminance2
    ? (luminance1 + 0.05) / (luminance2 + 0.05)
    : (luminance2 + 0.05) / (luminance1 + 0.05);
  return contrast >= 3; // At least 3:1 ratio for fashion (less strict than text)
};

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 60 requests per minute per IP
    const clientId = getClientIdentifier(req);
    const rateLimit = checkRateLimit(clientId, { windowMs: 60_000, maxRequests: 60 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
      );
    }

    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { color, harmonyType = 'recommended' } = body;

    if (!color || typeof color !== 'string') {
      return NextResponse.json(
        { error: 'Valid color name, hex code, or RGB value is required' },
        { status: 400 }
      );
    }


    // Validate and parse the input color
    let inputColorObj: chroma.Color;
    try {
      inputColorObj = chroma(color);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid color format. Use hex (#FF0000), RGB (rgb(255,0,0)), or color name (turquoise, chartreuse, etc.)' },
        { status: 400 }
      );
    }

    const inputHex = inputColorObj.hex();
    const inputRgb = inputColorObj.css();
    const [h, s, l] = inputColorObj.hsl();
    const inputHue = h || 0;

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


    // Helper function to ensure fashionable colors (not too dark or too light)
    const adjustForFashion = (color: chroma.Color): chroma.Color => {
      const [h, s, l] = color.hsl();
      // Ensure saturation is at least 0.2 (20%) for vibrant colors
      const adjustedS = Math.max(0.2, Math.min(0.9, s));
      // Ensure lightness is between 0.25 and 0.85 for wearable colors
      const adjustedL = Math.max(0.25, Math.min(0.85, l));
      return chroma.hsl(h || 0, adjustedS, adjustedL);
    };

    // Determine actual harmony type (handle 'recommended' mode)
    const actualHarmonyType = harmonyType === 'recommended' 
      ? getRecommendedHarmony(inputColorObj)
      : harmonyType;
    

    // Generate harmonious colors based on color theory with improved reliability
    const harmonyHues = HARMONY_TYPES[actualHarmonyType as keyof typeof HARMONY_TYPES](inputHue);
    
    // Determine usage distribution based on harmony type
    const getUsageType = (index: number, totalColors: number): 'primary' | 'secondary' | 'accent' => {
      if (totalColors === 1) return 'accent';
      if (index === 0) return 'secondary';
      if (index === 1 && totalColors > 2) return 'secondary';
      return 'accent';
    };
    
    const getUsageRatio = (usage: 'primary' | 'secondary' | 'accent', index: number): string => {
      if (usage === 'primary') return '60% - Main pieces';
      if (usage === 'secondary') return index === 0 ? '30% - Secondary' : '20% - Secondary';
      return '10% - Accents';
    };

    const matches: ColorMatch[] = harmonyHues.map((targetHue, index) => {
      // Create harmonious color with adjusted saturation and lightness for better fashion appeal
      let harmonyColor: chroma.Color;
      
      if (harmonyType === 'monochromatic') {
        // For monochromatic, use same hue with varied lightness
        const lightnessVariations = [0.3, 0.4, 0.6, 0.7];
        harmonyColor = chroma.hsl(inputHue, Math.max(0.3, s), lightnessVariations[index % lightnessVariations.length]);
      } else if (harmonyType === 'analogous') {
        // For analogous, keep similar saturation and lightness
        harmonyColor = chroma.hsl(targetHue, s * 0.9, l);
      } else if (harmonyType === 'complementary') {
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

      const usageType = getUsageType(index, harmonyHues.length);
      
      return {
        label: harmonyType === 'complementary' && index === 0 
          ? 'Complementary' 
          : harmonyType === 'analogous'
          ? index === 0 ? 'Analogous +30°' : 'Analogous -30°'
          : harmonyType === 'triadic'
          ? `Triadic ${index + 1}`
          : harmonyType === 'split_complementary'
          ? `Split Comp ${index + 1}`
          : harmonyType === 'tetradic'
          ? `Tetradic ${index + 1}`
          : `Shade ${index + 1}`,
        hex: finalHex,
        rgb: finalColor.css(),
        name: bestMatch.distance < 40 
          ? bestMatch.name.charAt(0).toUpperCase() + bestMatch.name.slice(1)
          : 'Custom ' + (index + 1),
        fashionContext: {
          usage: usageType,
          ratio: getUsageRatio(usageType, index),
          clothingItems: getSuggestedClothing(finalColor, usageType),
          styleNotes: getStyleNotes(finalColor, usageType, actualHarmonyType),
        },
      };
    });

    // Add improved monochromatic variations (lighter and darker shades with better contrast)
    const addShadeVariation = (baseColor: chroma.Color, adjustment: number, label: string): ColorMatch => {
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
        fashionContext: {
          usage: 'accent',
          ratio: '5-10% - Tonal accents',
          clothingItems: getSuggestedClothing(finalColor, 'accent'),
          styleNotes: adjustment > 0 
            ? 'Lighter variation adds brightness and dimension.'
            : 'Darker variation adds depth and sophistication.',
        },
      };
    };

    // Add lighter and darker variations with improved quality
    matches.push(addShadeVariation(inputColorObj, 1, 'Lighter Shade'));
    matches.push(addShadeVariation(inputColorObj, -1, 'Darker Shade'));
    
    // Add a tint and shade for more variety
    if (matches.length < 10) {
      matches.push(addShadeVariation(inputColorObj, 0.5, 'Light Tint'));
    }
    if (matches.length < 10) {
      matches.push(addShadeVariation(inputColorObj, -0.5, 'Dark Tone'));
    }


    return NextResponse.json({
      inputColor: {
        hex: inputHex,
        rgb: inputRgb,
        name: closestColorName.charAt(0).toUpperCase() + closestColorName.slice(1),
        fashionContext: {
          usage: 'primary' as const,
          ratio: '60% - Main pieces',
          clothingItems: getSuggestedClothing(inputColorObj, 'primary'),
          styleNotes: `Your base color. Build your outfit around this ${actualHarmonyType} harmony.`,
        },
      },
      matches,
      harmonyType: actualHarmonyType,
      requestedHarmonyType: harmonyType,
      isRecommended: harmonyType === 'recommended',
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to process color matching',
        details: 'An unexpected error occurred while matching colors. Please try again.'
      },
      { status: 500 }
    );
  }
}