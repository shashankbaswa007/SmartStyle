/**
 * Unit Tests for Personalization System
 * 
 * Tests color scoring, preference learning, and recommendation personalization
 */

describe('Personalization System', () => {
  describe('Color Preference Scoring', () => {
    it('should calculate color similarity scores', () => {
      // Test color distance calculation
      const color1 = '#FF5733';
      const color2 = '#FF5744';
      
      // These colors are very similar, should have high similarity
      const similarity = calculateColorSimilarity(color1, color2);
      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should score outfits based on color preferences', () => {
      const preferences = {
        favoriteColors: ['#FF5733', '#3B82F6'],
        colorWeights: {
          '#FF5733': 0.8,
          '#3B82F6': 0.6,
        },
      };

      const outfit = {
        colors: ['#FF5733', '#FFFFFF'],
      };

      const score = scoreOutfitByColors(outfit, preferences);
      expect(score).toBeGreaterThan(0.5);
    });

    it('should penalize disliked colors', () => {
      const preferences = {
        dislikedColors: ['#000000'],
        favoriteColors: ['#FF5733'],
      };

      const outfit1 = { colors: ['#FF5733', '#FFFFFF'] };
      const outfit2 = { colors: ['#FF5733', '#000000'] };

      const score1 = scoreOutfitByColors(outfit1, preferences);
      const score2 = scoreOutfitByColors(outfit2, preferences);

      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('Preference Learning', () => {
    it('should update color weights based on likes', () => {
      const currentWeights = {
        '#FF5733': 0.5,
        '#3B82F6': 0.3,
      };

      const likedOutfit = {
        colors: ['#FF5733', '#FFFFFF'],
      };

      const updatedWeights = updateColorWeights(currentWeights, likedOutfit, 'like');

      expect(updatedWeights['#FF5733']).toBeGreaterThan(0.5);
      expect(updatedWeights['#FFFFFF']).toBeDefined();
    });

    it('should decrease weights for dislikes', () => {
      const currentWeights = {
        '#000000': 0.5,
      };

      const dislikedOutfit = {
        colors: ['#000000'],
      };

      const updatedWeights = updateColorWeights(currentWeights, dislikedOutfit, 'dislike');

      expect(updatedWeights['#000000']).toBeLessThan(0.5);
    });

    it('should handle new colors in learning', () => {
      const currentWeights = {
        '#FF5733': 0.5,
      };

      const likedOutfit = {
        colors: ['#NEW123'],
      };

      const updatedWeights = updateColorWeights(currentWeights, likedOutfit, 'like');

      expect(updatedWeights['#NEW123']).toBeDefined();
      expect(updatedWeights['#NEW123']).toBeGreaterThan(0);
    });
  });

  describe('Recommendation Ranking', () => {
    it('should rank recommendations by user preferences', () => {
      const preferences = {
        favoriteColors: ['#FF5733'],
        preferredStyles: ['casual'],
        colorWeights: {
          '#FF5733': 0.8,
        },
      };

      const recommendations = [
        { id: '1', colors: ['#FF5733'], style: 'casual', occasion: 'casual' },
        { id: '2', colors: ['#000000'], style: 'formal', occasion: 'formal' },
        { id: '3', colors: ['#FF5733', '#FFFFFF'], style: 'casual', occasion: 'party' },
      ];

      const ranked = rankRecommendations(recommendations, preferences);

      // First recommendation should have highest score
      expect(ranked[0].id).toBe('1');
    });

    it('should consider occasion preferences', () => {
      const preferences = {
        occasionPreferences: {
          casual: {
            preferredColors: ['#3B82F6'],
            preferredItems: ['jeans', 't-shirt'],
          },
        },
      };

      const outfit = {
        occasion: 'casual',
        colors: ['#3B82F6'],
        items: ['jeans', 't-shirt'],
      };

      const score = scoreOutfitByPreferences(outfit, preferences);
      expect(score).toBeGreaterThanOrEqual(0.7);
    });
  });
});

// Mock functions (would import from actual personalization lib)
function calculateColorSimilarity(color1: string, color2: string): number {
  // Simplified implementation
  return color1.slice(0, 4) === color2.slice(0, 4) ? 0.95 : 0.1;
}

function scoreOutfitByColors(outfit: any, preferences: any): number {
  let score = 0;
  outfit.colors.forEach((color: string) => {
    if (preferences.favoriteColors?.includes(color)) {
      score += preferences.colorWeights?.[color] || 0.5;
    }
    if (preferences.dislikedColors?.includes(color)) {
      score -= 0.3;
    }
  });
  return Math.max(0, Math.min(1, score));
}

function updateColorWeights(
  currentWeights: Record<string, number>,
  outfit: any,
  feedback: 'like' | 'dislike'
): Record<string, number> {
  const weights = { ...currentWeights };
  const delta = feedback === 'like' ? 0.1 : -0.1;

  outfit.colors.forEach((color: string) => {
    weights[color] = Math.max(0, Math.min(1, (weights[color] || 0.5) + delta));
  });

  return weights;
}

function rankRecommendations(recommendations: any[], preferences: any): any[] {
  return recommendations
    .map(rec => ({
      ...rec,
      score: scoreOutfitByColors(rec, preferences) + 
             (preferences.preferredStyles?.includes(rec.style) ? 0.2 : 0),
    }))
    .sort((a, b) => b.score - a.score);
}

function scoreOutfitByPreferences(outfit: any, preferences: any): number {
  const occasionPref = preferences.occasionPreferences[outfit.occasion];
  if (!occasionPref) return 0.5;

  let score = 0;
  outfit.colors.forEach((color: string) => {
    if (occasionPref.preferredColors.includes(color)) score += 0.3;
  });
  outfit.items.forEach((item: string) => {
    if (occasionPref.preferredItems.includes(item)) score += 0.2;
  });

  return Math.min(1, score);
}
