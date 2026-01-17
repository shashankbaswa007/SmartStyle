/**
 * Unit Tests for Validation Schemas
 * 
 * Tests Zod schemas for data validation
 */

import { describe, it, expect } from '@jest/globals';
import {
  hexColorSchema,
  outfitSchema,
  likedOutfitSchema,
  userPreferencesSchema,
  validateData,
  safeValidateData,
} from '../schemas';

describe('Validation Schemas', () => {
  describe('hexColorSchema', () => {
    it('should validate correct hex colors', () => {
      expect(() => validateData(hexColorSchema, '#FF5733')).not.toThrow();
      expect(() => validateData(hexColorSchema, '#FFF')).not.toThrow();
    });

    it('should normalize hex colors to uppercase', () => {
      const result = validateData(hexColorSchema, '#ff5733');
      expect(result).toBe('#FF5733');
    });

    it('should reject invalid hex colors', () => {
      expect(() => validateData(hexColorSchema, '#GGGGGG')).toThrow();
      expect(() => validateData(hexColorSchema, 'FF5733')).toThrow();
      expect(() => validateData(hexColorSchema, '#FF57')).toThrow();
    });

    it('should work with safeValidateData', () => {
      const validResult = safeValidateData(hexColorSchema, '#FF5733');
      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(validResult.data).toBe('#FF5733');
      }

      const invalidResult = safeValidateData(hexColorSchema, '#GGGGGG');
      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        expect(invalidResult.error).toContain('Invalid hex color format');
      }
    });
  });

  describe('outfitSchema', () => {
    const validOutfit = {
      id: 'outfit_123',
      imageUrl: 'https://example.com/image.jpg',
      colors: ['#FF5733', '#3B82F6'],
      occasion: 'casual' as const,
      gender: 'female' as const,
    };

    it('should validate correct outfit data', () => {
      expect(() => validateData(outfitSchema, validOutfit)).not.toThrow();
    });

    it('should reject outfit without required fields', () => {
      const invalidOutfit: any = { ...validOutfit };
      delete invalidOutfit.imageUrl;
      expect(() => validateData(outfitSchema, invalidOutfit)).toThrow();
    });

    it('should reject invalid occasions', () => {
      const invalidOutfit = { ...validOutfit, occasion: 'invalid' };
      expect(() => validateData(outfitSchema, invalidOutfit)).toThrow();
    });

    it('should reject empty colors array', () => {
      const invalidOutfit = { ...validOutfit, colors: [] };
      expect(() => validateData(outfitSchema, invalidOutfit)).toThrow();
    });

    it('should validate optional fields', () => {
      const outfitWithOptional = {
        ...validOutfit,
        description: 'A beautiful dress',
        category: 'dress' as const,
        season: 'summer' as const,
      };
      expect(() => validateData(outfitSchema, outfitWithOptional)).not.toThrow();
    });
  });

  describe('likedOutfitSchema', () => {
    const validLikedOutfit = {
      id: 'outfit_123',
      userId: 'user_456',
      imageUrl: 'https://example.com/image.jpg',
      colors: ['#FF5733'],
      occasion: 'casual' as const,
      gender: 'female' as const,
      likedAt: new Date(),
      wornCount: 0,
    };

    it('should validate correct liked outfit data', () => {
      expect(() => validateData(likedOutfitSchema, validLikedOutfit)).not.toThrow();
    });

    it('should reject without userId', () => {
      const invalidOutfit: any = { ...validLikedOutfit };
      delete invalidOutfit.userId;
      expect(() => validateData(likedOutfitSchema, invalidOutfit)).toThrow();
    });

    it('should default wornCount to 0', () => {
      const { wornCount, ...outfitWithoutCount } = validLikedOutfit;
      const result = validateData(likedOutfitSchema, outfitWithoutCount);
      expect(result.wornCount).toBe(0);
    });

    it('should accept string dates', () => {
      const outfitWithStringDate = {
        ...validLikedOutfit,
        likedAt: '2026-01-12T00:00:00.000Z',
      };
      expect(() => validateData(likedOutfitSchema, outfitWithStringDate)).not.toThrow();
    });
  });

  describe('userPreferencesSchema', () => {
    const validPreferences = {
      userId: 'user_123',
      favoriteColors: ['#FF5733', '#3B82F6'],
      dislikedColors: ['#000000'],
      preferredOccasions: ['casual', 'party'] as const,
      totalLikes: 5,
      totalDislikes: 2,
      totalRecommendations: 10,
      recentLikedOutfitIds: ['outfit_1', 'outfit_2'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should validate correct preferences', () => {
      expect(() => validateData(userPreferencesSchema, validPreferences)).not.toThrow();
    });

    it('should reject preferences without userId', () => {
      const invalid: any = { ...validPreferences };
      delete invalid.userId;
      expect(() => validateData(userPreferencesSchema, invalid)).toThrow();
    });

    it('should validate color arrays', () => {
      const invalidColors = {
        ...validPreferences,
        favoriteColors: ['#GGGGGG'],
      };
      expect(() => validateData(userPreferencesSchema, invalidColors)).toThrow();
    });

    it('should limit array sizes', () => {
      const tooManyColors = {
        ...validPreferences,
        favoriteColors: Array(15).fill('#FF5733'),
      };
      expect(() => validateData(userPreferencesSchema, tooManyColors)).toThrow();
    });

    it('should default numeric fields to 0', () => {
      const minimal = {
        userId: 'user_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = validateData(userPreferencesSchema, minimal);
      expect(result.totalLikes).toBe(0);
      expect(result.totalDislikes).toBe(0);
      expect(result.totalRecommendations).toBe(0);
    });
  });
});
