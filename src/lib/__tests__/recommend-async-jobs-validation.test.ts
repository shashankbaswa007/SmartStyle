/** @jest-environment node */

import { describe, expect, it } from '@jest/globals';

jest.mock('@/ai/flows/analyze-image-and-provide-recommendations', () => ({
  analyzeImageAndProvideRecommendations: jest.fn(),
}));

jest.mock('@/lib/distributed-cache', () => ({
  getDistributedJson: jest.fn(),
  setDistributedJson: jest.fn(),
}));

jest.mock('@/lib/distributed-lock', () => ({
  acquireDistributedLock: jest.fn(),
  releaseDistributedLock: jest.fn(),
}));

jest.mock('@/lib/redis', () => ({
  getRedisClient: jest.fn(() => null),
}));

jest.mock('@/lib/interaction-tracker', () => ({
  generateSessionId: jest.fn(() => 'test-session-id'),
}));

import { __testables } from '@/lib/recommend/async-jobs';

type AnalysisShape = {
  feedback: string;
  highlights: string[];
  colorSuggestions: Array<{ name: string; hex: string; reason?: string }>;
  outfitRecommendations: Array<{
    title: string;
    description: string;
    items: string[];
    colorPalette: string[];
    imagePrompt: string;
    styleType?: string;
  }>;
  notes: string;
  imagePrompt: string;
};

function validAnalysis(): AnalysisShape {
  return {
    feedback:
      'Your fit is balanced and wearable. The silhouette works well for day-to-evening transitions and can be elevated with one contrast layer.',
    highlights: ['Strong color anchor in top layer', 'Clean proportions across pieces'],
    colorSuggestions: [
      { name: 'Midnight Navy', hex: '#1E3A8A' },
      { name: 'Ivory', hex: '#F8F5F0' },
      { name: 'Forest Green', hex: '#166534' },
    ],
    outfitRecommendations: [
      {
        title: 'Tailored Layers',
        description:
          'Pair structured trousers with a fitted knit and lightweight overshirt for sharp weekday polish. Add clean sneakers for comfort while preserving the tailored silhouette. Finish with a minimal watch to keep the look refined and cohesive.',
        items: ['overshirt', 'knit tee', 'tailored trousers'],
        colorPalette: ['#1E3A8A', '#F8F5F0', '#166534'],
        imagePrompt: 'Tailored overshirt and knit layered with trousers in navy ivory green',
        styleType: 'smart-casual',
      },
      {
        title: 'Weekend Relaxed',
        description:
          'Use a breathable camp-collar shirt over straight denim to keep movement easy and the shape clean. Ground the look with minimal trainers and a tonal belt. Add a lightweight overshirt for cooler evenings and extra texture.',
        items: ['camp-collar shirt', 'straight denim', 'trainers'],
        colorPalette: ['#334155', '#E2E8F0', '#0F766E'],
        imagePrompt: 'Relaxed weekend outfit with camp collar shirt and denim',
        styleType: 'relaxed',
      },
      {
        title: 'Evening Contrast',
        description:
          'Introduce a darker outer layer with a crisp base to build evening contrast and depth. Finish with simple leather shoes to keep the outfit refined and cohesive. Keep accessories understated so the silhouette and color balance remain the focus.',
        items: ['dark blazer', 'crisp tee', 'tapered pants'],
        colorPalette: ['#111827', '#FAFAF9', '#7C2D12'],
        imagePrompt: 'Evening contrast outfit with dark blazer and crisp tee',
        styleType: 'elevated',
      },
    ],
    notes: 'Good base proportions.',
    imagePrompt: 'High quality editorial style outfit collage',
  };
}

function expectJobError(fn: () => void, code: string): void {
  try {
    fn();
    throw new Error('Expected validation to throw');
  } catch (error: any) {
    expect(error?.code).toBe(code);
  }
}

describe('recommend async job validation', () => {
  it('accepts a complete recommendation payload', () => {
    const payload = validAnalysis();
    expect(() => __testables.validateAnalysisResponse(payload as any)).not.toThrow();
  });

  it('rejects short outfit descriptions as ML_EMPTY_RESPONSE', () => {
    const payload = validAnalysis();
    payload.outfitRecommendations[0].description = 'Nice look.';

    expectJobError(() => __testables.validateAnalysisResponse(payload as any), 'ML_EMPTY_RESPONSE');
  });

  it('rejects invalid outfit color hex values as INVALID_RESPONSE', () => {
    const payload = validAnalysis();
    payload.outfitRecommendations[1].colorPalette = ['#334155', '#E2E8F0', 'teal'];

    expectJobError(() => __testables.validateAnalysisResponse(payload as any), 'INVALID_RESPONSE');
  });

  it('rejects outfit descriptions with fewer than 3 sentences', () => {
    const payload = validAnalysis();
    payload.outfitRecommendations[0].description =
      'Structured layers look sharp for weekday dressing. Keep the accessories minimal.';

    expectJobError(() => __testables.validateAnalysisResponse(payload as any), 'ML_EMPTY_RESPONSE');
  });

  it('rejects outfit color palette longer than 4 colors', () => {
    const payload = validAnalysis();
    payload.outfitRecommendations[0].colorPalette = ['#1E3A8A', '#F8F5F0', '#166534', '#0F172A', '#7C2D12'];

    expectJobError(() => __testables.validateAnalysisResponse(payload as any), 'INVALID_RESPONSE');
  });

  it('rejects missing image prompt in top outfits as INVALID_RESPONSE', () => {
    const payload = validAnalysis();
    payload.outfitRecommendations[2].imagePrompt = '';

    expectJobError(() => __testables.validateAnalysisResponse(payload as any), 'INVALID_RESPONSE');
  });

  it('rejects missing top-level notes as INVALID_RESPONSE', () => {
    const payload = validAnalysis();
    payload.notes = '';

    expectJobError(() => __testables.validateAnalysisResponse(payload as any), 'INVALID_RESPONSE');
  });

  it('rejects short top-level image prompt as INVALID_RESPONSE', () => {
    const payload = validAnalysis();
    payload.imagePrompt = 'Short prompt';

    expectJobError(() => __testables.validateAnalysisResponse(payload as any), 'INVALID_RESPONSE');
  });

  it('rejects repetitive diversified output as INVALID_RESPONSE', () => {
    const payload = validAnalysis();
    payload.outfitRecommendations[1].title = payload.outfitRecommendations[0].title;
    payload.outfitRecommendations[1].styleType = payload.outfitRecommendations[0].styleType;
    payload.outfitRecommendations[2].styleType = payload.outfitRecommendations[0].styleType;

    expectJobError(() => __testables.validateDiversificationConformance(payload as any), 'INVALID_RESPONSE');
  });
});