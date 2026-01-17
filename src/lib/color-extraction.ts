/**
 * Professional Color Extraction Utility
 * Uses advanced heuristic algorithms for accurate clothing color detection
 * Same approach used for user image analysis - ensures consistency
 */

import { createCanvas, loadImage, Image } from 'canvas';

export interface ColorInfo {
  hex: string;
  name: string;
  r: number;
  g: number;
  b: number;
  count: number;
}

export interface ExtractedColors {
  dominantColors: string[];
  colorNames: string[];
  colorPalette: ColorInfo[];
  skinTone?: string;
}

/**
 * Convert RGB to HSV color space
 */
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  const s = max === 0 ? 0 : (diff / max) * 100;
  const v = max * 100;

  if (diff !== 0) {
    switch (max) {
      case r:
        h = 60 * (((g - b) / diff) % 6);
        break;
      case g:
        h = 60 * ((b - r) / diff + 2);
        break;
      case b:
        h = 60 * ((r - g) / diff + 4);
        break;
    }
  }

  if (h < 0) h += 360;

  return { h, s, v };
}

/**
 * Check if RGB values represent skin color
 */
function isSkinColor(r: number, g: number, b: number): boolean {
  // Method 1: Basic RGB range check
  const rgbCheck =
    r > 95 &&
    g > 40 &&
    b > 20 &&
    r > g &&
    r > b &&
    Math.abs(r - g) > 15;

  // Method 2: YCbCr color space check (more accurate for diverse skin tones)
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

  const ycbcrCheck = cr >= 133 && cr <= 173 && cb >= 77 && cb <= 127;

  // Method 3: HSV check for skin tone range
  const hsv = rgbToHsv(r, g, b);
  const hsvCheck = hsv.h >= 0 && hsv.h <= 50 && hsv.s >= 0.23 * 100 && hsv.s <= 0.68 * 100;

  // Return true if at least 2 methods agree
  const checks = [rgbCheck, ycbcrCheck, hsvCheck].filter(Boolean).length;
  return checks >= 2;
}

/**
 * Get color name from RGB values
 */
function getColorName(r: number, g: number, b: number): string {
  const hsv = rgbToHsv(r, g, b);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  // Check for achromatic colors first
  if (hsv.s < 10) {
    if (luminance < 50) return 'black';
    if (luminance > 200) return 'white';
    return 'gray';
  }

  // Categorize by hue
  const hue = hsv.h;
  const sat = hsv.s;
  const val = hsv.v;

  const isPastel = sat < 30;
  const isDark = val < 40;
  const isBright = val > 75 && sat > 60;

  let baseName = '';

  if (hue >= 0 && hue < 15) baseName = 'red';
  else if (hue >= 15 && hue < 45) baseName = isDark ? 'brown' : 'orange';
  else if (hue >= 45 && hue < 75) baseName = 'yellow';
  else if (hue >= 75 && hue < 150) baseName = 'green';
  else if (hue >= 150 && hue < 200) baseName = 'cyan';
  else if (hue >= 200 && hue < 260) baseName = 'blue';
  else if (hue >= 260 && hue < 300) baseName = 'purple';
  else if (hue >= 300 && hue < 330) baseName = 'magenta';
  else baseName = 'red';

  if (isPastel) return `light ${baseName}`;
  if (isDark) return `dark ${baseName}`;
  if (isBright) return `bright ${baseName}`;

  return baseName;
}

/**
 * Extract colors from image using advanced heuristic algorithms
 * @param imageUrlOrBuffer - Image URL or Buffer
 * @returns Extracted color information
 */
export async function extractColorsFromImage(
  imageUrlOrBuffer: string | Buffer
): Promise<ExtractedColors> {
  try {
    console.log('🎨 Starting heuristic color extraction...');

    // Load image
    const img = await loadImage(imageUrlOrBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    console.log(`📐 Image dimensions: ${width}x${height}`);

    // STAGE 1: Fast skin detection to locate person/mannequin
    const skinPixels: { x: number; y: number; r: number; g: number; b: number }[] = [];
    const skinSampleRate = 12;

    for (let y = 0; y < height; y += skinSampleRate) {
      for (let x = 0; x < width; x += skinSampleRate) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        if (isSkinColor(r, g, b)) {
          skinPixels.push({ x, y, r, g, b });
        }
      }
    }

    // Calculate center from skin pixels
    let centerX = width / 2;
    let centerY = height / 2;

    if (skinPixels.length > 20) {
      centerX = skinPixels.reduce((sum, p) => sum + p.x, 0) / skinPixels.length;
      centerY = skinPixels.reduce((sum, p) => sum + p.y, 0) / skinPixels.length;
    }

    // STAGE 2: Define region of interest
    const radius = Math.min(width, height) * 0.35;
    const bodyStartY = Math.max(0, centerY - radius * 0.5);
    const bodyEndY = Math.min(height, centerY + radius * 1.2);
    const bodyStartX = Math.max(0, centerX - radius * 0.8);
    const bodyEndX = Math.min(width, centerX + radius * 0.8);

    // STAGE 3: Build color histogram from clothing region
    const colorMap = new Map<string, { count: number; r: number; g: number; b: number }>();
    const clothingSampleRate = 10;

    for (let y = bodyStartY; y < bodyEndY; y += clothingSampleRate) {
      for (let x = bodyStartX; x < bodyEndX; x += clothingSampleRate) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a < 128) continue;
        if (isSkinColor(r, g, b)) continue;

        const hsv = rgbToHsv(r, g, b);

        // Distance from center
        const distFromCenter = Math.sqrt(
          Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
        );
        const normalizedDist = distFromCenter / radius;

        if (normalizedDist > 1.2) continue;

        // Background rejection
        const isBackground =
          (hsv.v > 90 && hsv.s < 15) ||
          (hsv.v < 8) ||
          (hsv.s < 8 && normalizedDist > 0.7) ||
          (hsv.h >= 0 && hsv.h <= 35 && hsv.s > 55 && hsv.v > 50 && normalizedDist > 0.6) ||
          (hsv.h >= 35 && hsv.h <= 65 && hsv.s > 40 && hsv.v > 65 && normalizedDist > 0.6) ||
          (hsv.h >= 200 && hsv.h <= 230 && hsv.s > 30 && hsv.s < 60 && hsv.v > 65) ||
          (hsv.h >= 100 && hsv.h <= 140 && hsv.s > 35 && hsv.s < 70 && hsv.v > 50 && normalizedDist > 0.6);

        if (isBackground) continue;

        // Accept clothing colors
        const isClothing =
          (hsv.s >= 5 && hsv.s <= 95 && hsv.v >= 12 && hsv.v <= 88) ||
          (hsv.s >= 1 && hsv.s <= 15 && hsv.v >= 15 && hsv.v <= 75 && normalizedDist < 0.8);

        if (!isClothing) continue;

        // Quantize colors
        const h_bin = Math.round(hsv.h / 12) * 12;
        const s_bin = Math.round(hsv.s / 15) * 15;
        const v_bin = Math.round(hsv.v / 15) * 15;
        const colorKey = `${h_bin},${s_bin},${v_bin}`;

        const proximityWeight = Math.max(1, Math.floor(8 * (1 - normalizedDist)));
        const weight = proximityWeight;

        const existing = colorMap.get(colorKey);
        if (existing) {
          existing.count += weight;
          existing.r = (existing.r * existing.count + r * weight) / (existing.count + weight);
          existing.g = (existing.g * existing.count + g * weight) / (existing.count + weight);
          existing.b = (existing.b * existing.count + b * weight) / (existing.count + weight);
        } else {
          colorMap.set(colorKey, { count: weight, r, g, b });
        }
      }
    }

    // STAGE 4: Extract dominant colors
    const colorArray = Array.from(colorMap.entries());
    const totalWeight = colorArray.reduce((sum, [, data]) => sum + data.count, 0);
    const threshold = totalWeight * 0.03;

    const candidateColors = colorArray
      .filter(([, data]) => data.count >= threshold)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 20)
      .map(([, data]) => ({
        r: Math.round(data.r),
        g: Math.round(data.g),
        b: Math.round(data.b),
        count: data.count,
        hex: `#${Math.round(data.r).toString(16).padStart(2, '0')}${Math.round(data.g).toString(16).padStart(2, '0')}${Math.round(data.b).toString(16).padStart(2, '0')}`,
        name: getColorName(Math.round(data.r), Math.round(data.g), Math.round(data.b))
      }));

    // Use chroma-js for diversity if available, otherwise use simple filtering
    let diverseColors = candidateColors;
    try {
      const chroma = require('chroma-js');
      diverseColors = [];
      const MIN_DELTA_E = 15;

      for (const candidate of candidateColors) {
        if (diverseColors.length === 0) {
          diverseColors.push(candidate);
          continue;
        }

        const isDifferent = diverseColors.every(existing => {
          try {
            const deltaE = chroma.deltaE(chroma(candidate.hex), chroma(existing.hex));
            return deltaE >= MIN_DELTA_E;
          } catch {
            return true;
          }
        });

        if (isDifferent) {
          diverseColors.push(candidate);
          if (diverseColors.length >= 10) break;
        }
      }
    } catch {
      // If chroma-js not available, use simple filtering
      diverseColors = candidateColors.slice(0, 10);
    }

    // Ensure at least 8 colors
    if (diverseColors.length < 8 && candidateColors.length > diverseColors.length) {
      diverseColors = candidateColors.slice(0, Math.max(8, diverseColors.length));
    }

    const dominantColors = diverseColors.map(c => c.hex);
    const colorNames = diverseColors.map(c => c.name);

    console.log(`✅ Extracted ${dominantColors.length} colors using heuristic analysis`);
    console.log(`   Colors: ${dominantColors.join(', ')}`);

    return {
      dominantColors,
      colorNames,
      colorPalette: diverseColors,
      skinTone: 'medium' // Optional field
    };
  } catch (error) {
    console.error('❌ Color extraction failed:', error);
    throw error;
  }
}

/**
 * Extract colors from image URL (downloads and processes)
 * @param imageUrl - URL of the image
 * @returns Extracted color information
 */
export async function extractColorsFromUrl(imageUrl: string): Promise<ExtractedColors> {
  console.log(`🔗 Downloading image from: ${imageUrl.substring(0, 60)}...`);
  
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    return await extractColorsFromImage(buffer);
  } catch (error) {
    console.error('❌ Failed to download/process image:', error);
    throw error;
  }
}
