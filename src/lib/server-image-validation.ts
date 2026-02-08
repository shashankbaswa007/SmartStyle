/**
 * SERVER-SIDE Image Validation and Security
 * 
 * This module provides robust server-side validation for uploaded images:
 * 1. Dimension validation (prevent memory exhaustion)
 * 2. EXIF data stripping (privacy protection)
 * 3. Format validation (prevent malicious files)
 * 4. Size verification (DoS prevention)
 */

import { createCanvas, loadImage, Image } from 'canvas';

// Security limits
const MAX_DIMENSION = 4096; // Max width or height (4K)
const MAX_PIXELS = 16_777_216; // Max total pixels (4096 x 4096)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  metadata?: {
    width: number;
    height: number;
    format: string;
    sizeBytes: number;
  };
  sanitizedDataUri?: string; // Image with EXIF stripped
}

/**
 * Validate and sanitize image on server-side
 * Checks dimensions, strips EXIF data, verifies format
 */
export async function validateAndSanitizeImage(
  dataUri: string
): Promise<ImageValidationResult> {
  try {
    // 1. Extract format and base64 data
    const matches = dataUri.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
    if (!matches) {
      return {
        isValid: false,
        error: 'Invalid image data URI format',
      };
    }

    const [, format, base64Data] = matches;
    
    // 2. Decode and check size
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid base64 encoding',
      };
    }

    const sizeBytes = buffer.length;
    if (sizeBytes > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `Image size (${(sizeBytes / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (10MB)`,
      };
    }

    // 3. Load image to get dimensions (also validates it's a real image)
    let img: Image;
    try {
      img = await loadImage(buffer);
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid or corrupted image file',
      };
    }

    const width = img.width;
    const height = img.height;

    // 4. Validate dimensions
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      return {
        isValid: false,
        error: `Image dimensions (${width}x${height}) exceed maximum allowed (${MAX_DIMENSION}x${MAX_DIMENSION})`,
      };
    }

    const totalPixels = width * height;
    if (totalPixels > MAX_PIXELS) {
      return {
        isValid: false,
        error: `Image has too many pixels (${totalPixels.toLocaleString()}). Maximum is ${MAX_PIXELS.toLocaleString()}`,
      };
    }

    // 5. Strip EXIF data by re-encoding the image
    // This removes all metadata including GPS, camera info, etc.
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img as any, 0, 0);

    // Convert to appropriate format
    let sanitizedBase64: string;
    const outputFormat = format.toLowerCase() === 'png' ? 'png' : 'jpeg';
    
    if (outputFormat === 'png') {
      const pngBuffer = canvas.toBuffer('image/png');
      sanitizedBase64 = pngBuffer.toString('base64');
    } else {
      // JPEG/JPG/WebP -> convert to JPEG
      const jpegBuffer = canvas.toBuffer('image/jpeg');
      sanitizedBase64 = jpegBuffer.toString('base64');
    }

    const sanitizedDataUri = `data:image/${outputFormat};base64,${sanitizedBase64}`;

    return {
      isValid: true,
      metadata: {
        width,
        height,
        format: outputFormat,
        sizeBytes,
      },
      sanitizedDataUri,
    };
  } catch (error) {
    console.error('Server-side image validation error:', error);
    return {
      isValid: false,
      error: 'Failed to validate image. Please try a different image.',
    };
  }
}

/**
 * Quick validation without full processing (faster for size checks)
 */
export function quickValidateImageDataUri(dataUri: string): {
  isValid: boolean;
  error?: string;
} {
  // Check format
  const formatMatch = dataUri.match(/^data:image\/(jpeg|jpg|png|webp);base64,/i);
  if (!formatMatch) {
    return {
      isValid: false,
      error: 'Invalid image format. Only JPEG, PNG, and WebP are allowed.',
    };
  }

  // Check base64 validity
  const base64Data = dataUri.split(',')[1];
  if (!base64Data || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
    return {
      isValid: false,
      error: 'Invalid base64 encoding.',
    };
  }

  // Check size
  const estimatedBytes = (base64Data.length * 3) / 4;
  if (estimatedBytes > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `Image exceeds maximum size of 10MB.`,
    };
  }

  return { isValid: true };
}

/**
 * Validate dimensions from a Buffer (before full processing)
 */
export async function validateImageDimensions(
  buffer: Buffer
): Promise<{ isValid: boolean; error?: string; width?: number; height?: number }> {
  try {
    const img = await loadImage(buffer);
    const width = img.width;
    const height = img.height;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      return {
        isValid: false,
        error: `Dimensions (${width}x${height}) exceed maximum (${MAX_DIMENSION}x${MAX_DIMENSION})`,
      };
    }

    const totalPixels = width * height;
    if (totalPixels > MAX_PIXELS) {
      return {
        isValid: false,
        error: `Too many pixels (${totalPixels.toLocaleString()}). Maximum is ${MAX_PIXELS.toLocaleString()}`,
      };
    }

    return {
      isValid: true,
      width,
      height,
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid image file',
    };
  }
}
