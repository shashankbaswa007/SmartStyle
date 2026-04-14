import type { AnalyzeImageAndProvideRecommendationsOutput } from '@/ai/flows/analyze-image-and-provide-recommendations';
import type { RecommendRequest } from '@/lib/validation';

type Outfit = AnalyzeImageAndProvideRecommendationsOutput['outfitRecommendations'][number];

type StrategyBucket = '70' | '20' | '10';

const STRATEGY_BUCKETS: StrategyBucket[] = ['70', '20', '10'];

function getStrategyLabel(bucket: StrategyBucket): string {
  if (bucket === '70') return '70% Core Match';
  if (bucket === '20') return '20% Style Stretch';
  return '10% Creative Edge';
}

function getStrategyMatchScore(bucket: StrategyBucket): number {
  if (bucket === '70') return 70;
  if (bucket === '20') return 20;
  return 10;
}

function getMatchCategory(bucket: StrategyBucket): 'perfect' | 'great' | 'exploring' {
  if (bucket === '70') return 'perfect';
  if (bucket === '20') return 'great';
  return 'exploring';
}

function buildStrategyExplanation(
  bucket: StrategyBucket,
  score: number,
  input: RecommendRequest,
  outfit: Outfit
): string {
  const occasion = normalize(input.occasion || outfit.occasion || 'your occasion');
  const genre = normalize(input.genre || outfit.styleType || 'your style');

  if (bucket === '70') {
    return `Core look (${Math.round(score)}% alignment): strongly matched to ${occasion} and ${genre} preferences.`;
  }

  if (bucket === '20') {
    return `Stretch look (${Math.round(score)}% alignment): keeps your ${occasion} context while introducing a fresh ${genre} variation.`;
  }

  return `Exploration look (${Math.round(score)}% alignment): intentionally adds a bolder option beyond your usual ${genre} choices.`;
}

function normalize(input: string): string {
  return (input || '').toLowerCase().trim();
}

function tokenize(input: string): string[] {
  return normalize(input)
    .split(/[\s,./|_-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function scoreOutfitInterestAlignment(outfit: Outfit, input: RecommendRequest): number {
  let score = 45;

  const occasion = normalize(input.occasion || '');
  const genre = normalize(input.genre || '');
  const description = normalize(outfit.description || '');
  const title = normalize(outfit.title || '');
  const outfitStyle = normalize(outfit.styleType || '');
  const outfitOccasion = normalize(outfit.occasion || '');
  const textBlob = `${title} ${description} ${outfitStyle} ${outfitOccasion}`;

  if (occasion && (outfitOccasion.includes(occasion) || textBlob.includes(occasion))) {
    score += 18;
  }

  if (genre && (outfitStyle.includes(genre) || textBlob.includes(genre))) {
    score += 17;
  }

  const inputColorTokens = Array.isArray(input.dressColors)
    ? input.dressColors.flatMap((color) => tokenize(color))
    : [];

  const paletteTokens = (outfit.colorPalette || []).flatMap((color) => tokenize(color));
  if (inputColorTokens.length > 0 && paletteTokens.length > 0) {
    const overlap = inputColorTokens.filter((token) => paletteTokens.includes(token)).length;
    const overlapRatio = overlap / Math.max(1, inputColorTokens.length);
    score += Math.round(overlapRatio * 20);
  }

  if (outfit.items && outfit.items.length >= 3) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

export function orderOutfitsByStrict701020(
  outfits: Outfit[],
  input: RecommendRequest
): Outfit[] {
  if (outfits.length <= 1) return outfits.slice(0, 3);

  return outfits
    .map((outfit) => ({
      outfit,
      score: scoreOutfitInterestAlignment(outfit, input),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const titleCompare = normalize(a.outfit.title || '').localeCompare(normalize(b.outfit.title || ''));
      if (titleCompare !== 0) return titleCompare;
      return normalize(a.outfit.styleType || '').localeCompare(normalize(b.outfit.styleType || ''));
    })
    .slice(0, 3)
    .map((entry) => entry.outfit);
}

export function enforceStrict701020(
  analysis: AnalyzeImageAndProvideRecommendationsOutput,
  input: RecommendRequest
): AnalyzeImageAndProvideRecommendationsOutput {
  const ordered = orderOutfitsByStrict701020(analysis.outfitRecommendations, input);

  const withMetadata = ordered.map((outfit, index) => {
    const bucket = STRATEGY_BUCKETS[index] || '10';
    const score = getStrategyMatchScore(bucket);

    return {
      ...outfit,
      matchScore: score,
      matchCategory: getMatchCategory(bucket),
      strategyBucket: bucket,
      strategyLabel: getStrategyLabel(bucket),
      explanation: buildStrategyExplanation(bucket, score, input, outfit),
      position: index + 1,
    };
  });

  return {
    ...analysis,
    outfitRecommendations: withMetadata,
  };
}
