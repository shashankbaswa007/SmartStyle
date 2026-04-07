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

function getAdaptiveTargets(input: RecommendRequest): [number, number, number] {
  const hasUser = !!input.userId && input.userId !== 'anonymous';
  const hasStrongContext = !!input.occasion && !!input.genre;
  const hasColorSignal = Array.isArray(input.dressColors) && input.dressColors.length > 0;

  if (hasUser && hasStrongContext && hasColorSignal) {
    return [82, 64, 42];
  }

  if (hasUser || hasStrongContext) {
    return [74, 56, 36];
  }

  return [66, 50, 32];
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

export function orderOutfitsByAdaptive701020(
  outfits: Outfit[],
  input: RecommendRequest
): Outfit[] {
  if (outfits.length <= 1) return outfits;

  const scored = outfits.map((outfit) => ({
    outfit,
    score: scoreOutfitInterestAlignment(outfit, input),
  }));

  const targets = getAdaptiveTargets(input);
  const selected: typeof scored = [];

  for (const target of targets) {
    const candidates = scored
      .filter((entry) => !selected.some((picked) => picked.outfit.title === entry.outfit.title))
      .sort((a, b) => {
        const aDistance = Math.abs(a.score - target);
        const bDistance = Math.abs(b.score - target);
        if (aDistance !== bDistance) return aDistance - bDistance;
        return b.score - a.score;
      });

    if (candidates.length > 0) {
      selected.push(candidates[0]);
    }
  }

  if (selected.length < Math.min(3, scored.length)) {
    const remainder = scored
      .filter((entry) => !selected.some((picked) => picked.outfit.title === entry.outfit.title))
      .sort((a, b) => b.score - a.score);

    for (const candidate of remainder) {
      selected.push(candidate);
      if (selected.length >= Math.min(3, scored.length)) break;
    }
  }

  return selected.map((entry) => entry.outfit);
}

export function enforceAdaptive701020(
  analysis: AnalyzeImageAndProvideRecommendationsOutput,
  input: RecommendRequest
): AnalyzeImageAndProvideRecommendationsOutput {
  const topThree = analysis.outfitRecommendations.slice(0, 3);
  const ordered = orderOutfitsByAdaptive701020(topThree, input);

  const withMetadata = ordered.map((outfit, index) => {
    const bucket = STRATEGY_BUCKETS[index] || '10';
    const score = scoreOutfitInterestAlignment(outfit, input);

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
