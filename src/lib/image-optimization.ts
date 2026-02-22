/**
 * Image Optimization Utility
 * Generates multi-resolution images (thumbnail, medium, full)
 * for optimal performance across different use cases
 */

export interface OptimizedImages {
  thumbnail: string;  // 150px - Grid view
  medium: string;     // 400px - Detail view
  full: string;       // 800px - Modal/full view
}

export interface CompressionOptions {
  maxWidth: number;
  quality: number;
  format?: 'image/jpeg' | 'image/webp';
}

/**
 * Compress an image to a specific size
 * @param dataUri - Original image data URI
 * @param maxWidth - Maximum width in pixels
 * @param quality - JPEG quality (0-1)
 * @returns Compressed image data URI
 */
export async function compressToSize(
  dataUri: string,
  maxWidth: number,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate dimensions maintaining aspect ratio
        const aspectRatio = img.height / img.width;
        const targetWidth = Math.min(img.width, maxWidth);
        const targetHeight = Math.round(targetWidth * aspectRatio);

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw resized image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Convert to data URI
        const compressedDataUri = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUri);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = dataUri;
  });
}

/**
 * Generate optimized images at multiple resolutions
 * @param originalDataUri - Original image data URI
 * @returns Object with thumbnail, medium, and full size images
 */
export async function generateOptimizedImages(
  originalDataUri: string
): Promise<OptimizedImages> {
  
  const startTime = Date.now();

  // Generate all sizes in parallel for speed
  const [thumbnail, medium, full] = await Promise.all([
    compressToSize(originalDataUri, 150, 0.80), // Thumbnail: 150px, 80% quality
    compressToSize(originalDataUri, 400, 0.85), // Medium: 400px, 85% quality
    compressToSize(originalDataUri, 800, 0.85), // Full: 800px, 85% quality
  ]);

  const duration = Date.now() - startTime;
  
  // Calculate size savings
  const originalSize = Math.round(originalDataUri.length / 1024);
  const thumbnailSize = Math.round(thumbnail.length / 1024);
  const mediumSize = Math.round(medium.length / 1024);
  const fullSize = Math.round(full.length / 1024);
  const totalSize = thumbnailSize + mediumSize + fullSize;


  return {
    thumbnail,
    medium,
    full,
  };
}

/**
 * Get appropriate image size based on usage context
 * @param images - Optimized images object
 * @param context - Usage context (grid, detail, modal)
 * @returns Appropriate image data URI
 */
export function getImageForContext(
  images: OptimizedImages,
  context: 'grid' | 'detail' | 'modal'
): string {
  switch (context) {
    case 'grid':
      return images.thumbnail;
    case 'detail':
      return images.medium;
    case 'modal':
      return images.full;
    default:
      return images.medium;
  }
}

/**
 * Estimate total size of optimized images in KB
 * @param images - Optimized images object
 * @returns Total size in KB
 */
export function estimateTotalSize(images: OptimizedImages): number {
  const sizes = [
    images.thumbnail.length,
    images.medium.length,
    images.full.length,
  ];
  return Math.round(sizes.reduce((sum, size) => sum + size, 0) / 1024);
}

/**
 * Check if optimized images exist in item data
 * @param imageUrl - Image URL or data URI
 * @returns Boolean indicating if this is an optimized image set
 */
export function isOptimizedImage(imageUrl: string): boolean {
  // Check if it's an object with thumbnail, medium, full properties
  // In Firestore, we'll store this as a nested object
  return false; // For now, assume single images need optimization
}

/**
 * Compress image with adaptive quality to stay under size limit
 * @param dataUri - Original image data URI
 * @param maxSizeKB - Maximum size in KB
 * @param maxWidth - Maximum width
 * @returns Compressed image data URI
 */
export async function compressToMaxSize(
  dataUri: string,
  maxSizeKB: number,
  maxWidth: number = 800
): Promise<string> {
  const qualities = [0.85, 0.75, 0.65, 0.55, 0.45];
  
  for (const quality of qualities) {
    const compressed = await compressToSize(dataUri, maxWidth, quality);
    const sizeKB = Math.round(compressed.length / 1024);
    
    if (sizeKB <= maxSizeKB) {
      return compressed;
    }
  }
  
  // If still too large, reduce dimensions further
  const finalCompressed = await compressToSize(dataUri, maxWidth * 0.7, 0.45);
  return finalCompressed;
}
