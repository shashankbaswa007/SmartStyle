/**
 * API Validation Schemas using Zod
 * Type-safe validation for all API endpoints
 */

import { z } from 'zod';

// ========================================
// RECOMMEND API VALIDATION
// ========================================

export const recommendRequestSchema = z.object({
  photoDataUri: z.string()
    .min(1, 'Photo data is required')
    .startsWith('data:image/', 'Invalid image data format'),
  
  occasion: z.enum(['office', 'casual', 'party', 'ethnic', 'workout', 'formal'])
    .optional(),
  
  genre: z.string()
    .optional(),
  
  gender: z.enum(['male', 'female', 'unisex'])
    .describe('User gender for outfit recommendations'),
  
  weather: z.string()
    .optional()
    .describe('Weather condition (e.g., sunny, rainy)'),
  
  skinTone: z.string()
    .optional()
    .describe('User skin tone for color matching'),
  
  dressColors: z.array(z.string())
    .optional()
    .describe('Current dress colors for complementary suggestions'),
  
  previousRecommendation: z.string()
    .optional()
    .describe('Previous recommendation ID to avoid repetition'),
  
  userId: z.string()
    .optional()
    .describe('User ID for personalized recommendations'),
});

export type RecommendRequest = z.infer<typeof recommendRequestSchema>;

// ========================================
// LIKES API VALIDATION
// ========================================

export const likeOutfitSchema = z.object({
  userId: z.string()
    .min(1, 'User ID is required'),
  
  outfit: z.object({
    title: z.string(),
    description: z.string(),
    imageUrl: z.string().url('Invalid image URL'),
    colorPalette: z.array(z.string()),
    styleType: z.string().optional(),
    items: z.array(z.string()),
    shoppingLinks: z.object({
      amazon: z.any().optional(),
      myntra: z.any().optional(),
      tatacliq: z.any().optional(),
    }).optional(),
  }),
  
  recommendationId: z.string()
    .optional(),
});

export type LikeOutfitRequest = z.infer<typeof likeOutfitSchema>;

// ========================================
// PREFERENCES API VALIDATION
// ========================================

export const updatePreferencesSchema = z.object({
  userId: z.string()
    .min(1, 'User ID is required'),
  
  colors: z.array(z.object({
    hex: z.string(),
    name: z.string(),
    weight: z.number(),
  })).optional(),
  
  styles: z.array(z.object({
    name: z.string(),
    weight: z.number(),
  })).optional(),
  
  occasions: z.array(z.string())
    .optional(),
  
  blocklist: z.object({
    colors: z.array(z.string()),
    styles: z.array(z.string()),
  }).optional(),
});

export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesSchema>;

// ========================================
// SHOPPING ANALYTICS VALIDATION
// ========================================

export const trackShoppingClickSchema = z.object({
  userId: z.string()
    .optional(),
  
  sessionId: z.string()
    .min(1, 'Session ID is required'),
  
  outfitTitle: z.string()
    .min(1, 'Outfit title is required'),
  
  itemName: z.string()
    .min(1, 'Item name is required'),
  
  platform: z.enum(['amazon', 'myntra', 'tatacliq'])
    .describe('Shopping platform'),
  
  productUrl: z.string()
    .url('Invalid product URL'),
  
  relevanceScore: z.number()
    .min(0)
    .max(100)
    .optional(),
});

export type TrackShoppingClickRequest = z.infer<typeof trackShoppingClickSchema>;

// ========================================
// INTERACTION TRACKING VALIDATION
// ========================================

export const trackInteractionSchema = z.object({
  userId: z.string()
    .min(1, 'User ID is required'),
  
  sessionId: z.string()
    .min(1, 'Session ID is required'),
  
  action: z.object({
    type: z.enum(['view', 'like', 'dislike', 'wear', 'shopping_click', 'share']),
    position: z.number().min(1).max(3),
    outfitId: z.string(),
    duration: z.number().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

export type TrackInteractionRequest = z.infer<typeof trackInteractionSchema>;

// ========================================
// VALIDATION HELPER FUNCTIONS
// ========================================

/**
 * Validate request body against schema
 * Returns { success: true, data } or { success: false, error }
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Format Zod errors for API response
 */
export function formatValidationError(error: z.ZodError): {
  message: string;
  errors: Array<{ field: string; message: string }>;
} {
  return {
    message: 'Validation failed',
    errors: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    })),
  };
}

/**
 * Express middleware for request validation
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (req: any, res: any, next: any) => {
    const result = validateRequest(schema, req.body);
    
    if (!result.success) {
      return res.status(400).json(formatValidationError(result.error));
    }
    
    // Attach validated data to request
    req.validatedBody = result.data;
    next();
  };
}
