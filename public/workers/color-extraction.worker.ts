/**
 * Web Worker for Color Extraction
 * Moves heavy color analysis to background thread for smooth 60fps UI
 */

// @ts-ignore - Web Worker context
self.onmessage = async (event: MessageEvent) => {
  const { type, imageData, options } = event.data;

  try {
    switch (type) {
      case 'extractColors':
        const colors = await extractColorsFromImageData(imageData, options);
        // @ts-ignore
        self.postMessage({ type: 'success', data: colors });
        break;

      case 'analyzeColorHarmony':
        const harmony = analyzeColorHarmony(options.colors);
        // @ts-ignore
        self.postMessage({ type: 'success', data: harmony });
        break;

      case 'detectSkinTones':
        const skinTones = detectSkinTones(imageData);
        // @ts-ignore
        self.postMessage({ type: 'success', data: skinTones });
        break;

      default:
        throw new Error(`Unknown task type: ${type}`);
    }
  } catch (error) {
    // @ts-ignore
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============================================================================
// COLOR EXTRACTION ALGORITHMS
// ============================================================================

interface ColorInfo {
  hex: string;
  rgb: [number, number, number];
  percentage: number;
  name?: string;
}

async function extractColorsFromImageData(
  imageData: ImageData,
  options: { maxColors?: number; quality?: number } = {}
): Promise<ColorInfo[]> {
  const { maxColors = 5, quality = 10 } = options;
  const pixels = imageData.data;
  const colorCounts = new Map<string, { count: number; rgb: [number, number, number] }>();
  
  // Sample pixels based on quality setting (higher = faster but less accurate)
  for (let i = 0; i < pixels.length; i += 4 * quality) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    // Skip transparent pixels and skin tones
    if (a < 125 || isSkinColor(r, g, b)) continue;

    // Quantize colors to reduce palette
    const quantizedR = Math.round(r / 51) * 51;
    const quantizedG = Math.round(g / 51) * 51;
    const quantizedB = Math.round(b / 51) * 51;
    
    const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
    const existing = colorCounts.get(colorKey);
    
    if (existing) {
      existing.count++;
    } else {
      colorCounts.set(colorKey, { count: 1, rgb: [quantizedR, quantizedG, quantizedB] });
    }
  }

  // Sort by frequency and get top colors
  const sortedColors = Array.from(colorCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxColors);

  const totalPixels = sortedColors.reduce((sum, [, data]) => sum + data.count, 0);

  return sortedColors.map(([, data]) => ({
    hex: rgbToHex(data.rgb[0], data.rgb[1], data.rgb[2]),
    rgb: data.rgb,
    percentage: (data.count / totalPixels) * 100,
  }));
}

// ============================================================================
// COLOR HARMONY ANALYSIS
// ============================================================================

function analyzeColorHarmony(colors: ColorInfo[]): {
  harmony: string;
  score: number;
  suggestions: string[];
} {
  // Convert colors to HSV for harmony analysis
  const hsvColors = colors.map(color => rgbToHsv(...color.rgb));
  
  // Check for complementary colors (opposite on color wheel)
  const hasComplementary = hsvColors.some((color1, i) =>
    hsvColors.slice(i + 1).some(color2 =>
      Math.abs(color1.h - color2.h) > 150 && Math.abs(color1.h - color2.h) < 210
    )
  );

  // Check for analogous colors (adjacent on color wheel)
  const hasAnalogous = hsvColors.some((color1, i) =>
    hsvColors.slice(i + 1).some(color2 =>
      Math.abs(color1.h - color2.h) < 30
    )
  );

  // Check for triadic colors (evenly spaced on color wheel)
  const hasTriadic = hsvColors.length >= 3 && hsvColors.some((color1, i) =>
    hsvColors.slice(i + 1).some((color2, j) =>
      hsvColors.slice(i + j + 2).some(color3 =>
        Math.abs((color1.h - color2.h) - (color2.h - color3.h)) < 20
      )
    )
  );

  let harmony = 'custom';
  let score = 70; // Base score
  const suggestions: string[] = [];

  if (hasComplementary) {
    harmony = 'complementary';
    score = 95;
    suggestions.push('Great use of complementary colors for high contrast!');
  } else if (hasTriadic) {
    harmony = 'triadic';
    score = 90;
    suggestions.push('Balanced triadic color scheme creates visual interest.');
  } else if (hasAnalogous) {
    harmony = 'analogous';
    score = 85;
    suggestions.push('Harmonious analogous colors create a cohesive look.');
  } else {
    suggestions.push('Consider adding complementary colors for more visual impact.');
  }

  return { harmony, score, suggestions };
}

// ============================================================================
// SKIN TONE DETECTION
// ============================================================================

function detectSkinTones(imageData: ImageData): {
  hasSkinTones: boolean;
  percentage: number;
} {
  const pixels = imageData.data;
  let skinPixelCount = 0;
  let totalPixels = 0;

  for (let i = 0; i < pixels.length; i += 4 * 5) { // Sample every 5th pixel
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a < 125) continue;

    totalPixels++;
    if (isSkinColor(r, g, b)) {
      skinPixelCount++;
    }
  }

  const percentage = (skinPixelCount / totalPixels) * 100;
  return {
    hasSkinTones: percentage > 5,
    percentage,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isSkinColor(r: number, g: number, b: number): boolean {
  // RGB-based skin tone detection
  const rgbCheck = r > 95 && g > 40 && b > 20 &&
                   r > g && r > b &&
                   Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
                   Math.abs(r - g) > 15;

  if (!rgbCheck) return false;

  // HSV-based verification
  const { h, s } = rgbToHsv(r, g, b);
  return h >= 0 && h <= 50 && s >= 0.2 && s <= 0.7;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(x => Math.round(x).toString(16).padStart(2, '0'))
    .join('');
}

function rgbToHsv(
  r: number,
  g: number,
  b: number
): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;

  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / diff + 2) / 6;
    } else {
      h = ((r - g) / diff + 4) / 6;
    }
  }

  return { h: h * 360, s, v };
}

export {};
