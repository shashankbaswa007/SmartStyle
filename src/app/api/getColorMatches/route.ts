import { NextRequest, NextResponse } from 'next/server';
import chroma from 'chroma-js';

interface ColorMatch {
  label: string;
  hex: string;
  rgb: string;
  name?: string;
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

// Color harmony calculation functions
const HARMONY_TYPES = {
  complementary: (hue: number) => [(hue + 180) % 360],
  analogous: (hue: number) => [(hue + 30) % 360, (hue - 30 + 360) % 360],
  triadic: (hue: number) => [(hue + 120) % 360, (hue + 240) % 360],
  split_complementary: (hue: number) => [(hue + 150) % 360, (hue + 210) % 360],
  tetradic: (hue: number) => [(hue + 90) % 360, (hue + 180) % 360, (hue + 270) % 360],
  monochromatic: (hue: number) => [hue], // Same hue, different saturation/lightness
};

export async function POST(req: NextRequest) {
  try {
    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { color, harmonyType = 'complementary' } = body;

    if (!color || typeof color !== 'string') {
      return NextResponse.json(
        { error: 'Valid color name, hex code, or RGB value is required' },
        { status: 400 }
      );
    }

    console.log('🎨 Finding color matches for:', color, 'using', harmonyType, 'harmony');

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

    console.log('🔍 Closest color name:', closestColorName, '(deltaE distance:', minDistance.toFixed(2), ')');

    // Generate harmonious colors based on color theory
    const harmonyHues = HARMONY_TYPES[harmonyType as keyof typeof HARMONY_TYPES](inputHue);
    
    const matches: ColorMatch[] = harmonyHues.map((targetHue, index) => {
      // Create harmonious color with similar saturation and lightness
      const harmonyColor = chroma.hsl(targetHue, s, l);
      
      // Find closest named color for this harmony color
      let bestMatch = { name: 'Unknown', hex: harmonyColor.hex(), distance: Infinity };
      
      Object.entries(FASHION_COLORS).forEach(([name, hex]) => {
        const distance = chroma.deltaE(harmonyColor, chroma(hex));
        if (distance < bestMatch.distance) {
          bestMatch = { name, hex, distance };
        }
      });

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
        hex: bestMatch.hex,
        rgb: chroma(bestMatch.hex).css(),
        name: bestMatch.name.charAt(0).toUpperCase() + bestMatch.name.slice(1),
      };
    });

    // Add monochromatic variations (lighter and darker shades)
    const lighterShade = inputColorObj.brighten(1);
    const darkerShade = inputColorObj.darken(1);

    const findClosestName = (color: chroma.Color) => {
      let bestMatch = { name: 'Unknown', hex: color.hex(), distance: Infinity };
      Object.entries(FASHION_COLORS).forEach(([name, hex]) => {
        const distance = chroma.deltaE(color, chroma(hex));
        if (distance < bestMatch.distance) {
          bestMatch = { name, hex, distance };
        }
      });
      return bestMatch.name.charAt(0).toUpperCase() + bestMatch.name.slice(1);
    };

    matches.push({
      label: 'Lighter Shade',
      hex: lighterShade.hex(),
      rgb: lighterShade.css(),
      name: findClosestName(lighterShade),
    });

    matches.push({
      label: 'Darker Shade',
      hex: darkerShade.hex(),
      rgb: darkerShade.css(),
      name: findClosestName(darkerShade),
    });

    console.log('✅ Generated', matches.length, 'color matches using', harmonyType, 'harmony');

    return NextResponse.json({
      inputColor: {
        hex: inputHex,
        rgb: inputRgb,
        name: closestColorName.charAt(0).toUpperCase() + closestColorName.slice(1),
      },
      matches,
      harmonyType,
    });
  } catch (error) {
    console.error('❌ Color matching error:', error);
    
    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process color',
        details: 'An unexpected error occurred while matching colors. Please try again.'
      },
      { status: 500 }
    );
  }
}