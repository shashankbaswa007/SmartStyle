import {
  recommendRequestSchema,
  likeOutfitSchema,
  trackShoppingClickSchema,
  validateRequest,
  formatValidationError,
} from '@/lib/validation';
import { z } from 'zod';

// Helper: minimal valid base64 jpeg data URI
const VALID_PHOTO_URI = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

describe('validation schemas', () => {
  // ── recommendRequestSchema ──────────────────────────────────────
  describe('recommendRequestSchema', () => {
    const validPayload = {
      photoDataUri: VALID_PHOTO_URI,
      occasion: 'office',
      genre: 'minimalist',
      gender: 'male' as const,
    };

    it('accepts a valid payload with required fields only', () => {
      const result = recommendRequestSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('accepts a valid full payload', () => {
      const result = recommendRequestSchema.safeParse({
        ...validPayload,
        occasion: 'office',
        genre: 'minimalist',
        weather: 'sunny',
        skinTone: 'medium',
        dressColors: ['red', 'blue'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing photoDataUri', () => {
      const result = recommendRequestSchema.safeParse({ gender: 'female' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid image MIME type', () => {
      const result = recommendRequestSchema.safeParse({
        ...validPayload,
        photoDataUri: 'data:image/gif;base64,R0lGODlh',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid gender enum', () => {
      const result = recommendRequestSchema.safeParse({
        ...validPayload,
        gender: 'other',
      });
      expect(result.success).toBe(false);
    });

    it('rejects occasion shorter than 3 chars', () => {
      const result = recommendRequestSchema.safeParse({
        ...validPayload,
        occasion: 'ab',
      });
      expect(result.success).toBe(false);
    });

    it('transforms comma-separated dressColors string to array', () => {
      const result = recommendRequestSchema.safeParse({
        ...validPayload,
        dressColors: 'red, blue, green',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dressColors).toEqual(['red', 'blue', 'green']);
      }
    });
  });

  // ── likeOutfitSchema ────────────────────────────────────────────
  describe('likeOutfitSchema', () => {
    const validLike = {
      userId: 'user123',
      outfit: {
        title: 'Summer Casual',
        description: 'A light outfit for warm weather',
        imageUrl: 'https://example.com/img.jpg',
        colorPalette: ['#FF0000', '#00FF00'],
        items: ['T-Shirt', 'Jeans'],
      },
    };

    it('accepts a valid like payload', () => {
      const result = likeOutfitSchema.safeParse(validLike);
      expect(result.success).toBe(true);
    });

    it('rejects empty userId', () => {
      const result = likeOutfitSchema.safeParse({ ...validLike, userId: '' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid imageUrl', () => {
      const result = likeOutfitSchema.safeParse({
        ...validLike,
        outfit: { ...validLike.outfit, imageUrl: 'not-a-url' },
      });
      expect(result.success).toBe(false);
    });
  });

  // ── trackShoppingClickSchema ────────────────────────────────────
  describe('trackShoppingClickSchema', () => {
    const validClick = {
      sessionId: 'sess123',
      outfitTitle: 'Evening Look',
      itemName: 'Blazer',
      platform: 'amazon' as const,
      productUrl: 'https://amazon.in/dp/B01234',
    };

    it('accepts a valid click payload', () => {
      const result = trackShoppingClickSchema.safeParse(validClick);
      expect(result.success).toBe(true);
    });

    it('rejects invalid platform', () => {
      const result = trackShoppingClickSchema.safeParse({
        ...validClick,
        platform: 'flipkart',
      });
      expect(result.success).toBe(false);
    });

    it('rejects relevance score outside 0-100', () => {
      const result = trackShoppingClickSchema.safeParse({
        ...validClick,
        relevanceScore: 150,
      });
      expect(result.success).toBe(false);
    });
  });

  // ── validateRequest helper ──────────────────────────────────────
  describe('validateRequest', () => {
    const schema = z.object({ name: z.string().min(1) });

    it('returns success with parsed data', () => {
      const result = validateRequest(schema, { name: 'test' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.name).toBe('test');
    });

    it('returns failure with ZodError', () => {
      const result = validateRequest(schema, { name: '' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBeInstanceOf(z.ZodError);
    });
  });

  // ── formatValidationError ───────────────────────────────────────
  describe('formatValidationError', () => {
    it('formats Zod errors into field-level messages', () => {
      const schema = z.object({ email: z.string().email() });
      const result = schema.safeParse({ email: 'bad' });
      if (!result.success) {
        const formatted = formatValidationError(result.error);
        expect(formatted.message).toBe('Validation failed');
        expect(formatted.errors[0]).toHaveProperty('field', 'email');
        expect(formatted.errors[0]).toHaveProperty('message');
      }
    });
  });
});
