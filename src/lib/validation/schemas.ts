/**
 * Zod Validation Schemas for Firestore Data
 * 
 * Ensures data consistency and type safety for all database operations.
 * Use these schemas before any Firestore write operation.
 */

import { z } from 'zod';

// ============================================
// COLOR VALIDATION
// ============================================

/**
 * Validates hex color codes (#RRGGBB or #RGB format)
 */
export const hexColorSchema = z
  .string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Invalid hex color format. Expected #RRGGBB or #RGB',
  })
  .transform((val) => val.toUpperCase()); // Normalize to uppercase

/**
 * Color analysis result from AI
 */
export const colorAnalysisSchema = z.object({
  dominant: z.array(hexColorSchema).min(1).max(10),
  accent: z.array(hexColorSchema).optional(),
  palette: z.array(hexColorSchema).optional(),
});

// ============================================
// OUTFIT SCHEMAS
// ============================================

/**
 * Core outfit data structure
 */
export const outfitSchema = z.object({
  id: z.string().min(1, 'Outfit ID is required'),
  imageUrl: z.string().url('Invalid image URL'),
  colors: z.array(hexColorSchema).min(1, 'At least one color required'),
  occasion: z.enum(['casual', 'formal', 'party', 'traditional', 'sports', 'business']),
  gender: z.enum(['male', 'female', 'unisex']),
  category: z.enum(['top', 'bottom', 'dress', 'fullsuit', 'accessories']).optional(),
  description: z.string().max(1000).optional(),
  season: z.enum(['spring', 'summer', 'fall', 'winter', 'all']).optional(),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).optional(),
});

/**
 * Liked outfit with user interaction data
 */
export const likedOutfitSchema = outfitSchema.extend({
  userId: z.string().min(1, 'User ID is required'),
  likedAt: z.date().or(z.string()),
  notes: z.string().max(500).optional(),
  wornCount: z.number().int().min(0).default(0),
  lastWornAt: z.date().or(z.string()).optional(),
});

/**
 * Generated outfit recommendation
 */
export const outfitRecommendationSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  imageUrl: z.string().url(),
  generatedImageUrl: z.string().url().optional(),
  colors: z.array(hexColorSchema).min(1),
  occasion: z.enum(['casual', 'formal', 'party', 'traditional', 'sports', 'business']),
  gender: z.enum(['male', 'female', 'unisex']),
  description: z.string().max(2000),
  aiAnalysis: z.string().max(5000).optional(),
  weatherConditions: z
    .object({
      temperature: z.number(),
      condition: z.string(),
      location: z.string().optional(),
    })
    .optional(),
  shoppingLinks: z
    .array(
      z.object({
        platform: z.string(),
        url: z.string().url(),
        title: z.string(),
        price: z.string().optional(),
      })
    )
    .optional(),
  createdAt: z.date().or(z.string()),
  feedback: z.enum(['liked', 'disliked', 'neutral']).optional(),
  feedbackAt: z.date().or(z.string()).optional(),
});

// ============================================
// USER PREFERENCE SCHEMAS
// ============================================

/**
 * Color weight for personalization
 */
export const colorWeightSchema = z.record(
  hexColorSchema,
  z.number().min(0).max(1, 'Color weight must be between 0 and 1')
);

/**
 * User style preferences
 */
export const userPreferencesSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  
  // Color preferences
  favoriteColors: z.array(hexColorSchema).max(10).default([]),
  dislikedColors: z.array(hexColorSchema).max(10).default([]),
  colorWeights: colorWeightSchema.optional(),
  topColors: z.array(hexColorSchema).max(5).optional(), // Denormalized field
  
  // Style preferences
  preferredOccasions: z
    .array(z.enum(['casual', 'formal', 'party', 'traditional', 'sports', 'business']))
    .default([]),
  preferredGenre: z.enum(['western', 'ethnic', 'fusion', 'minimal', 'bold']).optional(),
  
  // Interaction metrics
  totalLikes: z.number().int().min(0).default(0),
  totalDislikes: z.number().int().min(0).default(0),
  totalRecommendations: z.number().int().min(0).default(0),
  recentLikedOutfitIds: z.array(z.string()).max(10).default([]), // Denormalized field
  
  // Metadata
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
  lastRecommendationAt: z.date().or(z.string()).optional(),
});

/**
 * Partial user preferences for updates (all fields optional)
 */
export const userPreferencesUpdateSchema = userPreferencesSchema.partial().required({ userId: true });

// ============================================
// FEEDBACK SCHEMAS
// ============================================

/**
 * User feedback on recommendation
 */
export const feedbackSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  recommendationId: z.string().min(1),
  type: z.enum(['like', 'dislike', 'neutral', 'worn', 'purchased']),
  colors: z.array(hexColorSchema).optional(),
  occasion: z.enum(['casual', 'formal', 'party', 'traditional', 'sports', 'business']).optional(),
  notes: z.string().max(500).optional(),
  createdAt: z.date().or(z.string()),
});

// ============================================
// RECOMMENDATION HISTORY SCHEMAS
// ============================================

/**
 * Recommendation history entry
 */
export const recommendationHistorySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  outfitId: z.string().min(1),
  colors: z.array(hexColorSchema).min(1),
  occasion: z.enum(['casual', 'formal', 'party', 'traditional', 'sports', 'business']),
  imageUrl: z.string().url(),
  feedback: z.enum(['liked', 'disliked', 'neutral']).optional(),
  createdAt: z.date().or(z.string()),
  viewedAt: z.date().or(z.string()).optional(),
});

// ============================================
// OUTFIT USAGE SCHEMAS
// ============================================

/**
 * Outfit usage tracking
 */
export const outfitUsageSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  outfitId: z.string().min(1),
  occasion: z.enum(['casual', 'formal', 'party', 'traditional', 'sports', 'business']),
  wornAt: z.date().or(z.string()),
  weatherConditions: z
    .object({
      temperature: z.number(),
      condition: z.string(),
    })
    .optional(),
  notes: z.string().max(500).optional(),
  photos: z.array(z.string().url()).max(5).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

// ============================================
// AUDIT LOG SCHEMAS
// ============================================

/**
 * Audit log entry for tracking changes
 */
export const auditLogSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  action: z.enum([
    'create',
    'update',
    'delete',
    'like',
    'dislike',
    'worn',
    'purchased',
    'preference_change',
  ]),
  collection: z.string().min(1),
  documentId: z.string().min(1),
  changes: z.record(z.string(), z.any()).optional(),
  previousData: z.record(z.string(), z.any()).optional(),
  newData: z.record(z.string(), z.any()).optional(),
  metadata: z
    .object({
      ipAddress: z.string().optional(),
      userAgent: z.string().optional(),
      platform: z.string().optional(),
    })
    .optional(),
  timestamp: z.date().or(z.string()),
});

// ============================================
// STORAGE REFERENCE SCHEMAS
// ============================================

/**
 * Firebase Storage reference for cleanup jobs
 */
export const storageReferenceSchema = z.object({
  path: z.string().min(1),
  url: z.string().url(),
  uploadedAt: z.date().or(z.string()),
  userId: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
  referencedIn: z.array(
    z.object({
      collection: z.string(),
      documentId: z.string(),
    })
  ),
});

// ============================================
// CLEANUP JOB SCHEMAS
// ============================================

/**
 * Cleanup job result
 */
export const cleanupJobResultSchema = z.object({
  jobId: z.string().min(1),
  jobType: z.enum(['orphaned_images', 'old_recommendations', 'expired_cache']),
  startedAt: z.date().or(z.string()),
  completedAt: z.date().or(z.string()),
  itemsProcessed: z.number().int().min(0),
  itemsDeleted: z.number().int().min(0),
  errors: z.array(z.string()).optional(),
  status: z.enum(['success', 'partial_success', 'failed']),
});

// ============================================
// TYPE EXPORTS (inferred from schemas)
// ============================================

export type HexColor = z.infer<typeof hexColorSchema>;
export type ColorAnalysis = z.infer<typeof colorAnalysisSchema>;
export type Outfit = z.infer<typeof outfitSchema>;
export type LikedOutfit = z.infer<typeof likedOutfitSchema>;
export type OutfitRecommendation = z.infer<typeof outfitRecommendationSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserPreferencesUpdate = z.infer<typeof userPreferencesUpdateSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type RecommendationHistory = z.infer<typeof recommendationHistorySchema>;
export type OutfitUsage = z.infer<typeof outfitUsageSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type StorageReference = z.infer<typeof storageReferenceSchema>;
export type CleanupJobResult = z.infer<typeof cleanupJobResultSchema>;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate data against schema and return typed result
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Safely validate data and return { success, data, error }
 */
export function safeValidateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const errorMessages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, error: errorMessages };
  }
}

/**
 * Validate array of items
 */
export function validateArray<T>(schema: z.ZodSchema<T>, items: unknown[]): T[] {
  return items.map((item, index) => {
    try {
      return schema.parse(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Validation failed for item ${index}: ${errorMessages}`);
      }
      throw error;
    }
  });
}
