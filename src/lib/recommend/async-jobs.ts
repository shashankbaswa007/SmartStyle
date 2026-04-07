import crypto from 'crypto';
import { analyzeImageAndProvideRecommendations } from '@/ai/flows/analyze-image-and-provide-recommendations';
import type { RecommendRequest } from '@/lib/validation';
import type { AnalyzeImageAndProvideRecommendationsOutput } from '@/ai/flows/analyze-image-and-provide-recommendations';
import { getDistributedJson, setDistributedJson } from '@/lib/distributed-cache';
import type { DistributedLock } from '@/lib/distributed-lock';
import { acquireDistributedLock, releaseDistributedLock } from '@/lib/distributed-lock';
import { executeWithTimeoutAndRetry } from '@/lib/external-request';
import { generateImageWithRetry } from '@/lib/smart-image-generation';
import { generateShoppingLinks } from '@/lib/shopping-query-optimizer';
import { generateSessionId } from '@/lib/interaction-tracker';
import saveRecommendation from '@/lib/firestoreRecommendations';
import { getRedisClient } from '@/lib/redis';
import { enforceAdaptive701020 } from '@/lib/recommend/diversification';

const JOB_TTL_SECONDS = 4 * 60 * 60;
const DEDUPE_TTL_SECONDS = 2 * 60 * 60;
export const RECOMMEND_JOB_TIMEOUT_MS = 60_000;
const METRIC_PREFIX = 'smartstyle:v1:metrics:recommend';
const RECENT_JOB_LIST_SIZE = 20;
const UX_VARIANTS = ['A', 'B'] as const;

type UxVariant = typeof UX_VARIANTS[number];

export type RecommendJobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type RecommendProgressStage = 'queued' | 'palette' | 'outfit_text' | 'images' | 'finalizing' | 'completed' | 'failed';

export interface RecommendPartialOutfit {
  title: string;
  description: string;
  colorPalette: string[];
  imageUrl: string | null;
  styleType?: string;
  occasion?: string;
  items?: string[];
  matchScore?: number;
  matchCategory?: 'perfect' | 'great' | 'exploring';
  strategyBucket?: '70' | '20' | '10';
  strategyLabel?: string;
  explanation?: string;
  position?: number;
}

export interface RecommendPartialPayload {
  analysis: {
    feedback: string;
    highlights: string[];
    colorSuggestions: Array<{ name: string; hex: string; reason?: string }>;
    outfitRecommendations: RecommendPartialOutfit[];
    notes: string;
    imagePrompt: string;
    provider?: 'gemini' | 'groq';
  };
}

export interface RecommendProgress {
  stage: RecommendProgressStage;
  queueWaitMs?: number;
  jobTimeMs?: number;
  imagesReady?: number;
  totalImages?: number;
}

export interface RecommendJobRecord {
  jobId: string;
  requestId?: string;
  status: RecommendJobStatus;
  dedupeKey: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  input: RecommendRequest;
  progress?: RecommendProgress;
  partialPayload?: RecommendPartialPayload;
  result?: any;
  fallbackSource?: 'cache' | 'similar' | 'simplified';
  error?: string;
}

type RecommendFailureCode =
  | 'ANALYSIS_TIMEOUT'
  | 'ML_FAILED'
  | 'ML_EMPTY_RESPONSE'
  | 'INVALID_RESPONSE'
  | 'IMAGE_GENERATION_FAILED'
  | 'JOB_PROCESSING_FAILED';

class RecommendJobError extends Error {
  code: RecommendFailureCode;

  constructor(code: RecommendFailureCode, message: string) {
    super(message);
    this.name = 'RecommendJobError';
    this.code = code;
  }
}

function now(): number {
  return Date.now();
}

function jobKey(jobId: string): string {
  return `recommend:job:${jobId}`;
}

function dedupePointerKey(dedupeKey: string): string {
  return `recommend:dedupe:${dedupeKey}`;
}

function recentJobsKey(userId: string): string {
  return `recommend:user:${userId}:recent_jobs`;
}

function metricKey(name: string): string {
  return `${METRIC_PREFIX}:${name}`;
}

function normalizeVariant(variant?: string): UxVariant {
  return variant === 'B' ? 'B' : 'A';
}

function variantMetricKey(variant: UxVariant, name: string): string {
  return metricKey(`variant:${variant}:${name}`);
}

async function incrMetric(name: string, by = 1): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.incrby(metricKey(name), by);
  } catch {
    // Non-critical metrics failure.
  }
}

async function getMetric(name: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;
  try {
    const value = await redis.get<number>(metricKey(name));
    return Number(value || 0);
  } catch {
    return 0;
  }
}

async function incrVariantMetric(variant: UxVariant, name: string, by = 1): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.incrby(variantMetricKey(variant, name), by);
  } catch {
    // Non-critical metrics failure.
  }
}

async function getVariantMetric(variant: UxVariant, name: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;
  try {
    const value = await redis.get<number>(variantMetricKey(variant, name));
    return Number(value || 0);
  } catch {
    return 0;
  }
}

function buildInputVector(input: RecommendRequest): Set<string> {
  const tokens = new Set<string>();
  const pushToken = (value?: string) => {
    const normalized = (value || '').toLowerCase().trim();
    if (normalized) tokens.add(normalized);
  };

  pushToken(input.occasion);
  pushToken(input.genre);
  pushToken(input.gender);
  pushToken(input.weather);
  pushToken(input.skinTone);

  if (input.weatherForecast?.trendSummary) {
    pushToken(input.weatherForecast.trendSummary);
  }

  if (Array.isArray(input.weatherForecast?.days)) {
    input.weatherForecast.days.forEach((day) => {
      pushToken(day.condition);
      pushToken(day.description);
      pushToken(day.dayLabel);
    });
  }

  if (Array.isArray(input.dressColors)) {
    input.dressColors.forEach((color) => pushToken(color));
  }

  return tokens;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set<string>();
  for (const item of a) {
    if (b.has(item)) intersection.add(item);
  }
  const union = new Set<string>([...a, ...b]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function buildPartialPayload(analysis: AnalyzeImageAndProvideRecommendationsOutput): RecommendPartialPayload {
  return {
    analysis: {
      feedback: analysis.feedback,
      highlights: analysis.highlights,
      colorSuggestions: analysis.colorSuggestions,
      outfitRecommendations: analysis.outfitRecommendations.slice(0, 3).map((outfit) => {
        const colorPalette = (outfit.colorPalette || []).map((c) => c || '#000000');

        return {
          title: outfit.title,
          description: outfit.description,
          colorPalette,
          imageUrl: null,
          styleType: outfit.styleType,
          occasion: outfit.occasion,
          items: outfit.items,
          matchScore: outfit.matchScore,
          matchCategory: outfit.matchCategory,
          strategyBucket: outfit.strategyBucket,
          strategyLabel: outfit.strategyLabel,
          explanation: outfit.explanation,
          position: outfit.position,
        };
      }),
      notes: analysis.notes,
      imagePrompt: analysis.imagePrompt,
      provider: analysis.provider,
    },
  };
}

function applyImageProgressToPartial(
  partial: RecommendPartialPayload,
  imageUrls: string[]
): RecommendPartialPayload {
  return {
    ...partial,
    analysis: {
      ...partial.analysis,
      outfitRecommendations: partial.analysis.outfitRecommendations.map((outfit, index) => ({
        ...outfit,
        imageUrl: imageUrls[index] || null,
      })),
    },
  };
}

async function getExactCachedCompletedResult(
  dedupeKey: string,
  currentJobId: string
): Promise<{ result: any; source: 'cache' } | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const existingJobId = await redis.get<string>(dedupePointerKey(dedupeKey));
    if (!existingJobId || existingJobId === currentJobId) return null;

    const existingJob = await getJob(existingJobId);
    if (!existingJob || existingJob.status !== 'completed' || !existingJob.result) return null;

    return { result: existingJob.result, source: 'cache' };
  } catch {
    return null;
  }
}

async function findSimilarCompletedResult(
  input: RecommendRequest,
  userId: string,
  currentJobId: string
): Promise<{ result: any; source: 'similar' } | null> {
  const redis = getRedisClient();
  if (!redis || !userId || userId === 'anonymous') return null;

  try {
    const recentJobIds = await redis.lrange(recentJobsKey(userId), 0, RECENT_JOB_LIST_SIZE - 1);
    if (!recentJobIds || recentJobIds.length === 0) return null;

    const inputVector = buildInputVector(input);
    let best: { score: number; result: any } | null = null;

    for (const candidateId of recentJobIds) {
      if (!candidateId || candidateId === currentJobId) continue;

      const candidateJob = await getJob(candidateId);
      if (!candidateJob || candidateJob.status !== 'completed' || !candidateJob.result) continue;

      const score = jaccardSimilarity(inputVector, buildInputVector(candidateJob.input));
      if (!best || score > best.score) {
        best = { score, result: candidateJob.result };
      }
    }

    if (!best || best.score < 0.35) return null;
    return { result: best.result, source: 'similar' };
  } catch {
    return null;
  }
}

async function recordRecentJob(userId: string, jobId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !userId || userId === 'anonymous') return;

  try {
    const key = recentJobsKey(userId);
    await redis.lpush(key, jobId);
    await redis.ltrim(key, 0, RECENT_JOB_LIST_SIZE - 1);
    await redis.expire(key, JOB_TTL_SECONDS);
  } catch {
    // Best-effort list maintenance.
  }
}

async function buildFallbackResultWithRecovery(
  job: RecommendJobRecord,
  fallbackCode: 'JOB_FALLBACK' | 'JOB_TIMEOUT_FALLBACK',
  errorClass?: RecommendFailureCode
): Promise<{ result: any; source: 'cache' | 'similar' | 'simplified' }> {
  const exactCached = await getExactCachedCompletedResult(job.dedupeKey, job.jobId);
  if (exactCached) {
    return {
      result: {
        ...exactCached.result,
        cached: true,
        cacheSource: 'exact-cache-recovery',
        code: errorClass || fallbackCode,
        fallbackCode,
      },
      source: 'cache',
    };
  }

  const similar = await findSimilarCompletedResult(job.input, job.input.userId || 'anonymous', job.jobId);
  if (similar) {
    return {
      result: {
        ...similar.result,
        cached: true,
        cacheSource: 'similar-recovery',
        code: errorClass || fallbackCode,
        fallbackCode,
      },
      source: 'similar',
    };
  }

  const fallbackAnalysis = enforceAdaptive701020(createFallbackAnalysis(job.input), job.input);
  return {
    result: {
      success: true,
      payload: {
        userId: job.input.userId || 'anonymous',
        timestamp: now(),
        occasion: job.input.occasion,
        genre: job.input.genre,
        gender: job.input.gender,
        weather: job.input.weather,
        weatherForecast: job.input.weatherForecast,
        skinTone: job.input.skinTone,
        dressColors: job.input.dressColors,
        sessionId: generateSessionId(),
        analysis: fallbackAnalysis,
      },
      recommendationId: null,
      cached: false,
      cacheSource: 'fallback',
      code: errorClass || fallbackCode,
      fallbackCode,
    },
    source: 'simplified',
  };
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function validateAnalysisResponse(analysis: AnalyzeImageAndProvideRecommendationsOutput): void {
  if (!analysis || !Array.isArray(analysis.outfitRecommendations)) {
    throw new RecommendJobError('INVALID_RESPONSE', 'AI response missing outfit recommendations.');
  }

  if (analysis.outfitRecommendations.length < 3) {
    throw new RecommendJobError('ML_EMPTY_RESPONSE', 'AI returned insufficient outfit recommendations.');
  }

  if (!Array.isArray(analysis.colorSuggestions) || analysis.colorSuggestions.length < 3) {
    throw new RecommendJobError('ML_EMPTY_RESPONSE', 'AI returned insufficient color suggestions.');
  }

  for (const color of analysis.colorSuggestions) {
    if (!color?.hex || !isValidHexColor(color.hex)) {
      throw new RecommendJobError('INVALID_RESPONSE', 'AI returned invalid color suggestions.');
    }
  }

  for (const outfit of analysis.outfitRecommendations.slice(0, 3)) {
    if (!outfit?.title || !outfit?.description || !Array.isArray(outfit.items) || outfit.items.length === 0) {
      throw new RecommendJobError('INVALID_RESPONSE', 'AI returned incomplete outfit recommendation data.');
    }
  }
}

function validateDiversificationConformance(analysis: AnalyzeImageAndProvideRecommendationsOutput): void {
  const topThree = analysis.outfitRecommendations.slice(0, 3);
  if (topThree.length < 3) {
    throw new RecommendJobError('INVALID_RESPONSE', 'Diversification requires three outfit recommendations.');
  }

  const uniqueTitles = new Set(topThree.map((outfit) => normalizeText(outfit.title)));
  if (uniqueTitles.size < 3) {
    throw new RecommendJobError('INVALID_RESPONSE', 'Outfit recommendations are too repetitive.');
  }

  const uniqueStyles = new Set(topThree.map((outfit) => normalizeText(outfit.styleType || '')));
  if (uniqueStyles.size < 2) {
    throw new RecommendJobError('INVALID_RESPONSE', 'Outfit recommendations lack style diversity.');
  }
}

function normalizeText(value: string): string {
  return (value || '').toLowerCase().trim();
}

function buildImageFallbackDataUri(title: string): string {
  const safeTitle = (title || 'Outfit Preview').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E1B4B"/><stop offset="1" stop-color="#312E81"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/><rect x="96" y="120" width="832" height="784" rx="52" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)"/><text x="512" y="478" text-anchor="middle" fill="#E9D5FF" font-size="42" font-family="Inter,Arial,sans-serif" font-weight="700">${safeTitle}</text><text x="512" y="548" text-anchor="middle" fill="#C4B5FD" font-size="28" font-family="Inter,Arial,sans-serif">Preview unavailable, retry recommended</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createFallbackAnalysis(input: RecommendRequest): AnalyzeImageAndProvideRecommendationsOutput {
  const occasion = input.occasion || 'casual outing';
  const genre = input.genre || 'smart casual';
  const weather = input.weather || 'moderate weather';
  const weeklySummary = input.weatherForecast?.trendSummary || 'mixed weather through the week';

  const colors = Array.isArray(input.dressColors) && input.dressColors.length > 0
    ? input.dressColors
    : ['#1F2937', '#F3F4F6', '#2563EB'];

  return {
    feedback:
      'We generated a resilient fallback recommendation while your full AI request is retried in the background. This keeps your styling flow fast and uninterrupted.',
    highlights: [
      'Use one deep tone plus one soft neutral for better contrast.',
      'Repeat one accent color in shoes or accessories for cohesion.',
      'Prioritize fit and clean layering for a premium silhouette.',
    ],
    colorSuggestions: [
      { name: 'Midnight Navy', hex: '#1E3A8A', reason: 'Adds polish and structure.' },
      { name: 'Ivory', hex: '#F8F5F0', reason: 'Keeps the outfit light and balanced.' },
      { name: 'Forest Green', hex: '#166534', reason: 'Adds depth while staying wearable.' },
      { name: 'Charcoal', hex: '#1F2937', reason: 'Reliable anchor neutral.' },
      { name: 'Soft Beige', hex: '#D6C7B0', reason: 'Warm neutral base.' },
      { name: 'Terracotta', hex: '#C2410C', reason: 'Controlled accent warmth.' },
      { name: 'Slate Gray', hex: '#475569', reason: 'Refined secondary neutral.' },
      { name: 'Burgundy', hex: '#7F1D1D', reason: 'Rich evening contrast.' },
    ],
    outfitRecommendations: [
      {
        title: 'Reliable Smart Casual',
        description:
          'A balanced look with practical layering and modern proportions. It keeps mobility and comfort while still looking intentional for day-to-evening transitions. Add one accent color from the palette to maintain visual focus.',
        colorPalette: [colors[0] || '#1E3A8A', colors[1] || '#F8F5F0', '#475569'],
        styleType: 'smart-casual',
        occasion,
        imagePrompt: `A ${input.gender} ${genre} outfit for ${occasion}, clean studio fashion photo`,
        shoppingLinks: { amazon: null, myntra: null, tatacliq: null },
        isExistingMatch: true,
        items: ['structured top', 'straight-fit bottom', 'versatile layer'],
      },
      {
        title: 'Elevated Occasion Look',
        description:
          'This variant adds stronger contrast and cleaner lines for a dressed-up outcome. It remains practical while increasing refinement through texture and silhouette control. The palette is tuned for repeatability across multiple occasions.',
        colorPalette: ['#166534', '#D6C7B0', '#1F2937'],
        styleType: 'elevated',
        occasion,
        imagePrompt: `A ${input.gender} elevated outfit for ${occasion} in ${weather}, editorial style`,
        shoppingLinks: { amazon: null, myntra: null, tatacliq: null },
        isExistingMatch: true,
        items: ['statement top', 'tailored bottom', 'minimal accessories'],
      },
      {
        title: 'Trend-Forward Variation',
        description:
          'A higher-contrast, fashion-forward interpretation with controlled visual impact. Neutral support tones keep it wearable for real situations while still feeling current. Use this when you want stronger style expression.',
        colorPalette: ['#7F1D1D', '#F8F5F0', '#475569'],
        styleType: 'fashion-forward',
        occasion,
        imagePrompt: `A ${input.gender} trend-forward ${genre} outfit for ${occasion}, clean background`,
        shoppingLinks: { amazon: null, myntra: null, tatacliq: null },
        isExistingMatch: false,
        items: ['accent piece', 'neutral base', 'modern footwear'],
      },
    ],
    notes: 'Use two neutrals and one accent for the most consistent results.',
    imagePrompt: `A curated ${input.gender} ${genre} wardrobe board for ${occasion} in ${weather}. Weekly planning context: ${weeklySummary}`,
    provider: 'gemini',
  };
}

function getWeatherForecastSignature(input: RecommendRequest): string {
  if (!input.weatherForecast?.days?.length) return 'none';
  return input.weatherForecast.days
    .slice(0, 7)
    .map((day) => `${day.date}:${day.condition}:${day.tempMin}-${day.tempMax}:${day.precipitationProbability}`)
    .join('|');
}

function buildDedupeKey(input: RecommendRequest, userId: string): string {
  const base64 = input.photoDataUri.split(',')[1] || input.photoDataUri;
  const imageHash = crypto.createHash('sha256').update(base64).digest('hex');
  const normalized = {
    userId,
    imageHash,
    occasion: (input.occasion || '').toLowerCase().trim(),
    genre: (input.genre || '').toLowerCase().trim(),
    gender: input.gender,
    weather: (input.weather || '').toLowerCase().trim(),
    weatherForecastSignature: getWeatherForecastSignature(input),
    weatherTrend: (input.weatherForecast?.trendSummary || '').toLowerCase().trim(),
    skinTone: (input.skinTone || '').toLowerCase().trim(),
    dressColors: Array.isArray(input.dressColors)
      ? [...input.dressColors].map((c) => c.toLowerCase().trim()).sort()
      : [],
    previousRecommendation: input.previousRecommendation || '',
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

async function getJob(jobId: string): Promise<RecommendJobRecord | null> {
  return getDistributedJson<RecommendJobRecord>(jobKey(jobId));
}

async function saveJob(job: RecommendJobRecord): Promise<void> {
  await setDistributedJson(jobKey(job.jobId), job, JOB_TTL_SECONDS);
}

export async function enqueueRecommendJob(
  input: RecommendRequest,
  userId: string,
  options?: { autoStart?: boolean; requestId?: string }
): Promise<{ jobId: string; deduped: boolean; status: RecommendJobStatus }> {
  const dedupeKey = buildDedupeKey(input, userId || 'anonymous');
  const redis = getRedisClient();
  const uxVariant = normalizeVariant(input.uxVariant);
  await incrMetric('total_requests', 1);
  await incrVariantMetric(uxVariant, 'requests', 1);

  const autoStart = options?.autoStart ?? true;
  const lockKey = `recommend:dedupe:lock:${dedupeKey}`;
  let dedupeLock: DistributedLock | null = null;

  if (redis) {
    const maxAttempts = 8;
    for (let attempt = 0; attempt < maxAttempts && !dedupeLock; attempt += 1) {
      dedupeLock = await acquireDistributedLock(lockKey, 5);
      if (!dedupeLock) {
        const backoffMs = Math.min(140, 35 * (attempt + 1));
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  try {
    if (redis) {
      try {
        const existingJobId = await redis.get<string>(dedupePointerKey(dedupeKey));
        if (existingJobId) {
          const existingJob = await getJob(existingJobId);
          if (existingJob && ['queued', 'processing', 'completed'].includes(existingJob.status)) {
            await incrMetric('dedupe_hits', 1);
            await incrMetric('ai_calls_avoided', 1);
            await incrVariantMetric(uxVariant, 'dedupe_hits', 1);
            await incrVariantMetric(uxVariant, 'ai_calls_avoided', 1);
            if (existingJob.status === 'completed') {
              await incrMetric('cache_hits', 1);
              await incrVariantMetric(uxVariant, 'cache_hits', 1);
            }
            return { jobId: existingJobId, deduped: true, status: existingJob.status };
          }
        }
      } catch {
        // Ignore pointer lookup failures and continue creating a new job.
      }
    }

    const jobId = crypto.randomUUID();
    const record: RecommendJobRecord = {
      jobId,
      requestId: options?.requestId,
      status: 'queued',
      dedupeKey,
      createdAt: now(),
      updatedAt: now(),
      input: { ...input, userId },
      progress: {
        stage: 'queued',
        queueWaitMs: 0,
        totalImages: 3,
        imagesReady: 0,
      },
    };

    await saveJob(record);

    if (redis) {
      try {
        await redis.set(dedupePointerKey(dedupeKey), jobId, { ex: DEDUPE_TTL_SECONDS });
        await redis.lpush('recommend:queue', jobId);
      } catch {
        // Queue metadata write is best effort.
      }
    }

    // Trigger processing asynchronously unless explicitly deferred by caller.
    if (autoStart) {
      void processRecommendJob(jobId);
    }

    return { jobId, deduped: false, status: 'queued' };
  } finally {
    if (dedupeLock) {
      await releaseDistributedLock(dedupeLock);
    }
  }
}

export async function startRecommendJob(jobId: string): Promise<void> {
  void processRecommendJob(jobId);
}

export async function markRecommendJobRateLimited(jobId: string, message: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  const updated: RecommendJobRecord = {
    ...job,
    status: 'failed',
    error: message,
    updatedAt: now(),
    completedAt: now(),
    progress: {
      ...(job.progress || { stage: 'queued' as RecommendProgressStage }),
      stage: 'failed',
      queueWaitMs: job.progress?.queueWaitMs,
      totalImages: job.progress?.totalImages || 3,
      imagesReady: job.progress?.imagesReady || 0,
      jobTimeMs: Math.max(0, now() - (job.startedAt || job.createdAt)),
    },
    result: {
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      status: 'rate_limited',
      error: message,
    },
  };

  await saveJob(updated);

  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(dedupePointerKey(updated.dedupeKey));
  } catch {
    // Best-effort dedupe pointer cleanup.
  }
}

export async function findExistingRecommendJob(
  input: RecommendRequest,
  userId: string
): Promise<{ jobId: string; status: RecommendJobStatus } | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  const dedupeKey = buildDedupeKey(input, userId || 'anonymous');
  try {
    const existingJobId = await redis.get<string>(dedupePointerKey(dedupeKey));
    if (!existingJobId) return null;

    const existingJob = await getJob(existingJobId);
    if (!existingJob) return null;

    if (!['queued', 'processing', 'completed'].includes(existingJob.status)) {
      return null;
    }

    return {
      jobId: existingJobId,
      status: existingJob.status,
    };
  } catch {
    return null;
  }
}

async function runWorkflow(job: RecommendJobRecord): Promise<any> {
  let analysis: AnalyzeImageAndProvideRecommendationsOutput;
  try {
    analysis = await executeWithTimeoutAndRetry(
      () => analyzeImageAndProvideRecommendations({
        photoDataUri: job.input.photoDataUri,
        occasion: job.input.occasion || '',
        genre: job.input.genre || '',
        gender: job.input.gender,
        weather: job.input.weather || '',
        weatherForecast: job.input.weatherForecast,
        weeklyWeatherSummary: job.input.weatherForecast?.trendSummary,
        skinTone: job.input.skinTone || '',
        dressColors: Array.isArray(job.input.dressColors)
          ? job.input.dressColors.join(', ')
          : (job.input.dressColors || ''),
        previousRecommendation: job.input.previousRecommendation || '',
        userId: job.input.userId || '',
      }),
      {
        timeoutMs: 12000,
        retries: 1,
        operationName: 'recommend.job.analysis',
      }
    );
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new RecommendJobError('ANALYSIS_TIMEOUT', 'Analysis timed out while contacting AI service.');
    }

    throw new RecommendJobError('ML_FAILED', error?.message || 'AI analysis failed.');
  }

  validateAnalysisResponse(analysis);
  analysis = enforceAdaptive701020(analysis, job.input);
  validateDiversificationConformance(analysis);

  job.partialPayload = buildPartialPayload(analysis);
  job.progress = {
    ...(job.progress || { stage: 'queued' as RecommendProgressStage }),
    stage: 'palette',
    totalImages: 3,
    imagesReady: 0,
  };
  job.updatedAt = now();
  await saveJob(job);

  job.progress = {
    ...(job.progress || { stage: 'queued' as RecommendProgressStage }),
    stage: 'outfit_text',
    totalImages: 3,
    imagesReady: 0,
  };
  job.updatedAt = now();
  await saveJob(job);

  const outfits = analysis.outfitRecommendations.slice(0, 3);
  const imageUrls: string[] = [];
  let failedImageCount = 0;
  const enrichedOutfits: Array<AnalyzeImageAndProvideRecommendationsOutput['outfitRecommendations'][number] & {
    imageUrl: string;
    generatedImageColors: null;
  }> = [];

  for (const outfit of outfits) {
      const colorHexCodes = outfit.colorPalette?.map((c) => {
        if (typeof c === 'string') return c;
        const colorObj = c as { hex?: string };
        return colorObj.hex || '#000000';
      }) || [];

      const shoppingLinksData = generateShoppingLinks({
        gender: job.input.gender,
        items: outfit.items,
        colorPalette: colorHexCodes.slice(0, 5),
        style: outfit.styleType || 'casual',
        description: outfit.description,
      });

      const shoppingLinks = {
        amazon: shoppingLinksData.byPlatform.amazon[0]?.url || null,
        myntra: shoppingLinksData.byPlatform.myntra[0]?.url || null,
        tatacliq: shoppingLinksData.byPlatform.tataCliq[0]?.url || null,
      };

      const imagePrompt = outfit.imagePrompt || `${outfit.title} ${outfit.items.join(' ')}`;
      let imageUrl: string;
      try {
        imageUrl = await generateImageWithRetry(imagePrompt, colorHexCodes, 16_000);
      } catch {
        failedImageCount += 1;
        imageUrl = buildImageFallbackDataUri(outfit.title);
      }
      imageUrls.push(imageUrl);

      if (job.partialPayload) {
        job.partialPayload = applyImageProgressToPartial(job.partialPayload, imageUrls);
      }

      job.progress = {
        ...(job.progress || { stage: 'queued' as RecommendProgressStage }),
        stage: 'images',
        totalImages: outfits.length,
        imagesReady: imageUrls.length,
      };
      job.updatedAt = now();
      await saveJob(job);

      enrichedOutfits.push({
        ...outfit,
        colorPalette: colorHexCodes.slice(0, 5),
        imageUrl,
        shoppingLinks,
        generatedImageColors: null,
      });
  }

  if (failedImageCount >= outfits.length) {
    throw new RecommendJobError('IMAGE_GENERATION_FAILED', 'Image generation failed for all recommendations.');
  }

  const payload = {
    userId: job.input.userId || 'anonymous',
    timestamp: now(),
    occasion: job.input.occasion,
    genre: job.input.genre,
    gender: job.input.gender,
    weather: job.input.weather,
    weatherForecast: job.input.weatherForecast,
    skinTone: job.input.skinTone,
    dressColors: job.input.dressColors,
    sessionId: generateSessionId(),
    analysis: {
      ...analysis,
      outfitRecommendations: enrichedOutfits,
    },
  };

  if (job.input.userId && job.input.userId !== 'anonymous') {
    void saveRecommendation(job.input.userId, payload).catch(() => {
      // Non-critical persistence failure.
    });
  }

  return {
    success: true,
    payload,
    recommendationId: null,
    cached: false,
    cacheSource: 'job',
  };
}

export async function processRecommendJob(jobId: string): Promise<void> {
  const existing = await getJob(jobId);
  if (!existing) return;
  if (existing.status === 'completed') return;

  let lock: DistributedLock | null = null;
  for (let attempt = 0; attempt < 3 && !lock; attempt += 1) {
    lock = await acquireDistributedLock(`recommend:job:lock:${jobId}`, 45);
    if (!lock && attempt < 2) {
      const backoffMs = 80 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  if (!lock) return;

  const start = now();
  try {
    const job = await getJob(jobId);
    if (!job) return;
    if (job.status === 'completed') return;

    const uxVariant = normalizeVariant(job.input.uxVariant);

    job.status = 'processing';
    job.startedAt = now();
    const queueWaitMs = Math.max(0, job.startedAt - job.createdAt);
    job.progress = {
      ...(job.progress || { stage: 'queued' as RecommendProgressStage }),
      stage: 'queued',
      queueWaitMs,
      totalImages: 3,
      imagesReady: 0,
    };
    job.updatedAt = now();
    await saveJob(job);

    await incrMetric('queue_wait_sum_ms', queueWaitMs);
    await incrMetric('queue_wait_count', 1);
    await incrVariantMetric(uxVariant, 'queue_wait_sum_ms', queueWaitMs);
    await incrVariantMetric(uxVariant, 'queue_wait_count', 1);

    await incrMetric('ai_calls_total', 1);

    const result = await runWorkflow(job);

    job.status = 'completed';
    job.result = result;
    job.completedAt = now();
    const jobTimeMs = Math.max(0, (job.completedAt || now()) - (job.startedAt || job.createdAt));
    job.progress = {
      ...(job.progress || { stage: 'queued' as RecommendProgressStage }),
      stage: 'completed',
      queueWaitMs: job.progress?.queueWaitMs,
      totalImages: 3,
      imagesReady: 3,
      jobTimeMs,
    };
    job.updatedAt = now();
    await saveJob(job);

    await recordRecentJob(job.input.userId || 'anonymous', jobId);

    const latency = Math.max(0, now() - start);
    await incrMetric('completed_total', 1);
    await incrMetric('latency_sum_ms', latency);
    await incrMetric('latency_count', 1);
    await incrMetric('job_time_sum_ms', jobTimeMs);
    await incrMetric('job_time_count', 1);
    await incrVariantMetric(uxVariant, 'completed', 1);
    await incrVariantMetric(uxVariant, 'time_to_result_sum_ms', jobTimeMs);
    await incrVariantMetric(uxVariant, 'time_to_result_count', 1);
  } catch (error: any) {
    const failed = await getJob(jobId);
    if (!failed) return;
    const uxVariant = normalizeVariant(failed.input.uxVariant);

    const errorCode: RecommendFailureCode =
      typeof error?.code === 'string'
        ? (error.code as RecommendFailureCode)
        : 'JOB_PROCESSING_FAILED';

    const fallback = await buildFallbackResultWithRecovery(failed, 'JOB_FALLBACK', errorCode);

    failed.status = 'failed';
    failed.error = error?.message || 'Job processing failed';
    failed.result = fallback.result;
    failed.fallbackSource = fallback.source;
    failed.progress = {
      ...(failed.progress || { stage: 'queued' as RecommendProgressStage }),
      stage: 'failed',
      jobTimeMs: Math.max(0, now() - (failed.startedAt || failed.createdAt)),
      queueWaitMs: failed.progress?.queueWaitMs,
      totalImages: failed.progress?.totalImages || 3,
      imagesReady: failed.progress?.imagesReady || 0,
    };
    failed.updatedAt = now();
    failed.completedAt = now();
    await saveJob(failed);

    await incrMetric('failed_total', 1);
    await incrMetric('fallback_total', 1);
    await incrMetric('fallback_source_' + fallback.source, 1);
    await incrVariantMetric(uxVariant, 'failed', 1);
    await incrVariantMetric(uxVariant, 'fallbacks', 1);
  } finally {
    await releaseDistributedLock(lock);
  }
}

export async function getRecommendJobStatus(jobId: string): Promise<RecommendJobRecord | null> {
  const job = await getJob(jobId);
  if (!job) return null;

  // Opportunistic processing in case background trigger was interrupted.
  if (job.status === 'queued') {
    void processRecommendJob(jobId);
  }

  if ((job.status === 'queued' || job.status === 'processing') && now() - job.createdAt > RECOMMEND_JOB_TIMEOUT_MS) {
    const timeoutFallback = await buildFallbackResultWithRecovery(job, 'JOB_TIMEOUT_FALLBACK', 'ANALYSIS_TIMEOUT');

    const timedOut: RecommendJobRecord = {
      ...job,
      status: 'failed',
      error: 'Job timed out',
      result: timeoutFallback.result,
      fallbackSource: timeoutFallback.source,
      progress: {
        ...(job.progress || { stage: 'queued' as RecommendProgressStage }),
        stage: 'failed',
        queueWaitMs: job.progress?.queueWaitMs,
        totalImages: job.progress?.totalImages || 3,
        imagesReady: job.progress?.imagesReady || 0,
        jobTimeMs: Math.max(0, now() - (job.startedAt || job.createdAt)),
      },
      updatedAt: now(),
      completedAt: now(),
    };

    await saveJob(timedOut);
    await incrMetric('failed_total', 1);
    await incrMetric('fallback_total', 1);
    await incrMetric('fallback_source_' + timeoutFallback.source, 1);
    const uxVariant = normalizeVariant(job.input.uxVariant);
    await incrVariantMetric(uxVariant, 'failed', 1);
    await incrVariantMetric(uxVariant, 'fallbacks', 1);
    return timedOut;
  }

  return job;
}

export async function awaitRecommendJobTerminalState(
  jobId: string,
  options?: { timeoutMs?: number; pollIntervalMs?: number }
): Promise<RecommendJobRecord | null> {
  const timeoutMs = Math.max(1000, options?.timeoutMs ?? 22_000);
  const pollIntervalMs = Math.max(200, options?.pollIntervalMs ?? 550);
  const startedAt = now();

  while (now() - startedAt < timeoutMs) {
    const job = await getRecommendJobStatus(jobId);
    if (!job) return null;

    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return getRecommendJobStatus(jobId);
}

export async function getRecommendMetrics(): Promise<{
  cache_hit_rate: number;
  dedupe_hit_rate: number;
  avg_job_time: number;
  queue_wait_time: number;
  fallback_rate: number;
  job_failure_rate: number;
  cacheHitRate: number;
  dedupeHitRate: number;
  avgJobTime: number;
  queueWaitTime: number;
  fallbackRate: number;
  jobFailureRate: number;
  aiCallsAvoided: number;
  totals: {
    requests: number;
    cacheHits: number;
    dedupeHits: number;
    aiCalls: number;
    completed: number;
    failed: number;
    fallbacks: number;
  };
  variants: Record<UxVariant, {
    completion_rate: number;
    time_to_result: number;
    fallback_usage_rate: number;
    interaction_rate: number;
    totals: {
      requests: number;
      completed: number;
      fallbacks: number;
      interactions: number;
    };
  }>;
}> {
  const [
    requests,
    cacheHits,
    dedupeHits,
    aiCalls,
    completed,
    failed,
    latencySum,
    latencyCount,
    aiCallsAvoided,
    queueWaitSum,
    queueWaitCount,
    jobTimeSum,
    jobTimeCount,
    fallbackTotal,
  ] = await Promise.all([
    getMetric('total_requests'),
    getMetric('cache_hits'),
    getMetric('dedupe_hits'),
    getMetric('ai_calls_total'),
    getMetric('completed_total'),
    getMetric('failed_total'),
    getMetric('latency_sum_ms'),
    getMetric('latency_count'),
    getMetric('ai_calls_avoided'),
    getMetric('queue_wait_sum_ms'),
    getMetric('queue_wait_count'),
    getMetric('job_time_sum_ms'),
    getMetric('job_time_count'),
    getMetric('fallback_total'),
  ]);

  const variantRows = await Promise.all(
    UX_VARIANTS.map(async (variant) => {
      const [
        vRequests,
        vCompleted,
        vFallbacks,
        vInteractions,
        vTimeSum,
        vTimeCount,
      ] = await Promise.all([
        getVariantMetric(variant, 'requests'),
        getVariantMetric(variant, 'completed'),
        getVariantMetric(variant, 'fallbacks'),
        getVariantMetric(variant, 'interactions'),
        getVariantMetric(variant, 'time_to_result_sum_ms'),
        getVariantMetric(variant, 'time_to_result_count'),
      ]);

      return {
        variant,
        data: {
          completion_rate: vRequests > 0 ? vCompleted / vRequests : 0,
          time_to_result: vTimeCount > 0 ? vTimeSum / vTimeCount : 0,
          fallback_usage_rate: vRequests > 0 ? vFallbacks / vRequests : 0,
          interaction_rate: vCompleted > 0 ? vInteractions / vCompleted : 0,
          totals: {
            requests: vRequests,
            completed: vCompleted,
            fallbacks: vFallbacks,
            interactions: vInteractions,
          },
        },
      };
    })
  );

  const variants = variantRows.reduce((acc, row) => {
    acc[row.variant] = row.data;
    return acc;
  }, {} as Record<UxVariant, {
    completion_rate: number;
    time_to_result: number;
    fallback_usage_rate: number;
    interaction_rate: number;
    totals: {
      requests: number;
      completed: number;
      fallbacks: number;
      interactions: number;
    };
  }>);

  const cacheHitRate = requests > 0 ? cacheHits / requests : 0;
  const dedupeHitRate = requests > 0 ? dedupeHits / requests : 0;
  const avgJobTime = jobTimeCount > 0 ? jobTimeSum / jobTimeCount : 0;
  const queueWaitTime = queueWaitCount > 0 ? queueWaitSum / queueWaitCount : 0;
  const fallbackRate = requests > 0 ? fallbackTotal / requests : 0;
  const jobFailureRate = requests > 0 ? failed / requests : 0;

  return {
    cache_hit_rate: cacheHitRate,
    dedupe_hit_rate: dedupeHitRate,
    avg_job_time: avgJobTime,
    queue_wait_time: queueWaitTime,
    fallback_rate: fallbackRate,
    job_failure_rate: jobFailureRate,
    cacheHitRate,
    dedupeHitRate,
    avgJobTime,
    queueWaitTime,
    fallbackRate,
    jobFailureRate,
    aiCallsAvoided,
    totals: {
      requests,
      cacheHits,
      dedupeHits,
      aiCalls,
      completed,
      failed,
      fallbacks: fallbackTotal,
    },
    variants,
  };
}

export async function recordRecommendInteraction(variant?: string): Promise<void> {
  const normalized = normalizeVariant(variant);
  await incrMetric('interactions_total', 1);
  await incrVariantMetric(normalized, 'interactions', 1);
}
