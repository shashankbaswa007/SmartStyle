import { describe, expect, it } from '@jest/globals';
import { enforceStrict701020, orderOutfitsByStrict701020, scoreOutfitInterestAlignment } from './diversification';
import type { RecommendRequest } from '../validation';

const baseInput: RecommendRequest = {
  photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
  occasion: 'office',
  genre: 'minimalist',
  gender: 'unisex',
  dressColors: ['#1F2937', '#F8F5F0'],
};

function outfit(title: string, styleType: string, occasion: string, colorPalette: string[], description = 'Detailed outfit recommendation with enough descriptive content for validation checks.'): any {
  return {
    title,
    description,
    colorPalette,
    styleType,
    occasion,
    imagePrompt: `${title} prompt`,
    shoppingLinks: { amazon: null, myntra: null, tatacliq: null },
    isExistingMatch: true,
    items: ['item one', 'item two', 'item three'],
  };
}

describe('recommend diversification', () => {
  it('scores stronger context matches higher', () => {
    const strong = outfit('Strong', 'minimalist', 'office', ['#1F2937', '#F8F5F0']);
    const weak = outfit('Weak', 'bohemian', 'party', ['#FF00AA', '#00FFAA']);

    const strongScore = scoreOutfitInterestAlignment(strong, baseInput);
    const weakScore = scoreOutfitInterestAlignment(weak, baseInput);

    expect(strongScore).toBeGreaterThan(weakScore);
  });

  it('returns deterministic 3-slot ordering for strict 70-20-10', () => {
    const outfits = [
      outfit('Safe', 'minimalist', 'office', ['#1F2937', '#F8F5F0']),
      outfit('Adjacent', 'minimal', 'work', ['#1F2937', '#A0AEC0']),
      outfit('Explore', 'streetwear', 'casual', ['#FF00AA', '#00FFAA']),
    ];

    const ordered = orderOutfitsByStrict701020(outfits, {
      ...baseInput,
      userId: 'user-123',
    });

    expect(ordered).toHaveLength(3);
    expect(new Set(ordered.map((entry: any) => entry.title)).size).toBe(3);
    expect(ordered[0].title).toBe('Safe');
  });

  it('adds strategy metadata for top three recommendations', () => {
    const analysis = {
      feedback: 'feedback',
      highlights: ['one', 'two'],
      colorSuggestions: [
        { name: 'Navy', hex: '#1F2937' },
        { name: 'Ivory', hex: '#F8F5F0' },
        { name: 'Blue', hex: '#2563EB' },
      ],
      outfitRecommendations: [
        outfit('Safe', 'minimalist', 'office', ['#1F2937', '#F8F5F0']),
        outfit('Adjacent', 'minimal', 'work', ['#1F2937', '#A0AEC0']),
        outfit('Explore', 'streetwear', 'casual', ['#FF00AA', '#00FFAA']),
      ],
      notes: 'note',
      imagePrompt: 'prompt',
      provider: 'gemini' as const,
    };

    const enriched = enforceStrict701020(analysis, { ...baseInput, userId: 'user-123' });
    const [first, second, third] = enriched.outfitRecommendations;

    expect(first.strategyBucket).toBe('70');
    expect(second.strategyBucket).toBe('20');
    expect(third.strategyBucket).toBe('10');
    expect(first.matchCategory).toBe('perfect');
    expect(second.matchCategory).toBe('great');
    expect(third.matchCategory).toBe('exploring');
    expect(typeof first.matchScore).toBe('number');
    expect(typeof first.explanation).toBe('string');
    expect(first.position).toBe(1);
    expect(second.position).toBe(2);
    expect(third.position).toBe(3);
  });
});
