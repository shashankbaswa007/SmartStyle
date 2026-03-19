import { NextResponse } from 'next/server';
import { analyzeImageAndProvideRecommendations } from '@/ai/flows/analyze-image-and-provide-recommendations';
import type { AnalyzeImageAndProvideRecommendationsOutput } from '@/ai/flows/analyze-image-and-provide-recommendations';
import { generateShoppingLinks } from '@/lib/shopping-query-optimizer';
import saveRecommendation from '@/lib/firestoreRecommendations';
import { withTimeout } from '@/lib/timeout-utils';
import crypto from 'crypto';
import { getComprehensivePreferences } from '@/lib/preference-engine';
import { getBlocklists } from '@/lib/blocklist-manager';
import { generateSessionId, createInteractionSession } from '@/lib/interaction-tracker';
import { getClientIdentifier } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { recommendationCache, createCacheKey } from '@/lib/request-cache';
import { recommendRequestSchema, validateRequest, formatValidationError } from '@/lib/validation';
import { quickValidateImageDataUri } from '@/lib/server-image-validation';
import { 
  calculateOutfitMatchScore, 
  applyDiversificationRule, 
  getAntiRepetitionCache, 
  addToAntiRepetitionCache,
  detectPatternLock 
} from '@/lib/recommendation-diversifier';
import { FirestoreCache } from '@/lib/firestore-cache';
import { checkDuplicateImage, generateImageHash } from '@/lib/image-deduplication';
import { generateImageWithRetry, createFallbackPlaceholder } from '@/lib/smart-image-generation';
import { getCachedImage, cacheImage } from '@/lib/image-cache';
import { verifyBearerTokenMatchesUser, AuthError } from '@/lib/server-auth';
import { checkServerRateLimit } from '@/lib/server-rate-limiter';

/**
 * Sanitize error messages to prevent XSS
 */
function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') return 'An error occurred';
  
  return message
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .substring(0, 200); // Limit length to prevent log flooding
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const reqLogger = logger.withContext({ requestId, route: '/api/recommend' });
  reqLogger.info('recommend.request.start', { startedAt: new Date().toISOString() });
  
  try {
    // Parse and validate request body with Zod
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      reqLogger.error('recommend.request.parse_failed', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate request body against schema
    const validation = validateRequest(recommendRequestSchema, body);
    if (!validation.success) {
      reqLogger.warn('recommend.request.validation_failed', {
        reason: 'schema_validation',
        details: validation.error,
      });
      return NextResponse.json(
        formatValidationError(validation.error),
        { status: 400 }
      );
    }

    // Use validated data (type-safe!)
    const { photoDataUri, occasion, genre, gender, weather, skinTone, dressColors, previousRecommendation, userId: requestedUserId } = validation.data;

    // Verify authentication: if a userId is provided, verify it matches the auth token
    let userId = requestedUserId;
    if (userId && userId !== 'anonymous') {
      try {
        await verifyBearerTokenMatchesUser(req, userId);
      } catch (error) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }

        return NextResponse.json(
          { error: 'Unauthorized - Invalid authentication token' },
          { status: 401 }
        );
      }
    }

    // Additional server-side security validation for image
    const imageValidation = quickValidateImageDataUri(photoDataUri);
    if (!imageValidation.isValid) {
      reqLogger.warn('recommend.request.image_validation_failed', {
        reason: imageValidation.error,
      });
      return NextResponse.json(
        { error: imageValidation.error },
        { status: 400 }
      );
    }

    // 🚀 OPTIMIZATION 1: Firestore-backed rate limiting (20 req/hour per user)
    const effectiveUserId = userId || 'anonymous';
    const clientId = getClientIdentifier(req);
    const rateLimitCheck = await checkServerRateLimit(`${effectiveUserId}:${clientId}`, {
      scope: 'recommend',
      windowMs: 60 * 60 * 1000,
      maxRequests: 20,
    });
    
    if (!rateLimitCheck.allowed) {
      reqLogger.warn('recommend.request.rate_limited', {
        userId: effectiveUserId,
        reason: 'firestore_rate_limit',
      });
      return NextResponse.json(
        { 
          error: rateLimitCheck.message,
          remaining: 0,
          resetAt: rateLimitCheck.resetAt,
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitCheck.resetAt.toISOString(),
          },
        }
      );
    }
    
    reqLogger.info('recommend.request.rate_limit_ok', {
      userId: effectiveUserId,
      remaining: rateLimitCheck.remaining,
    });

    reqLogger.info('recommend.flow.start', {
      hasPhoto: !!photoDataUri,
      occasion: occasion || 'not specified',
      gender,
      hasUserId: !!userId,
      remaining: rateLimitCheck.remaining,
    });

    // Generate image hash for caching and deduplication
    const imageHash = generateImageHash(photoDataUri);
    
    // 🚀 OPTIMIZATION 2: Image Deduplication (check last 24h)
    if (userId && userId !== 'anonymous') {
      const duplicateResult = await checkDuplicateImage(userId, imageHash);
      if (duplicateResult) {
        reqLogger.info('recommend.cache.hit', {
          cacheSource: '24h-history',
          userId,
          reason: 'duplicate_image',
        });
        return NextResponse.json({
          ...duplicateResult,
          message: 'You recently uploaded this photo. Here are your previous recommendations.',
          performance: {
            cached: true,
            source: '24h-history',
            savedTime: '~10s',
          }
        });
      }
    }
    
    // 🚀 OPTIMIZATION 3: Firestore Cache Check  
    const firestoreCache = new FirestoreCache();
    const cacheParams = {
      imageHash,
      colors: Array.isArray(dressColors) ? dressColors : (dressColors ? [dressColors] : []),
      gender,
      occasion: occasion || 'casual',
    };
    
    const cachedResult = await firestoreCache.get(cacheParams);
    if (cachedResult) {
      const totalTime = Date.now() - startTime;
      reqLogger.info('recommend.cache.hit', {
        cacheSource: 'firestore',
        userId,
        latencyMs: totalTime,
      });
      logger.metric('recommend.latency_ms', totalTime, {
        requestId,
        cacheSource: 'firestore',
      });
      
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        cacheSource: 'firestore',
        performanceMs: totalTime,
        message: 'Results from recent similar request (saves your rate limit)',
      });
    }
    
    reqLogger.info('recommend.cache.miss', {
      cacheSource: 'none',
      reason: 'no_recent_cached_result',
    });

    // ✨ NEW: Fetch user preferences and blocklists for personalization
    let userPreferences = null;
    let userBlocklists = null;
    let sessionId = generateSessionId();
    
    if (userId && userId !== 'anonymous') {
      reqLogger.info('recommend.personalization.fetch_start', { userId });
      const prefStart = Date.now();
      
      try {
        [userPreferences, userBlocklists] = await Promise.all([
          getComprehensivePreferences(userId),
          getBlocklists(userId),
        ]);
        
        const prefLatency = Date.now() - prefStart;
        reqLogger.info('recommend.personalization.fetch_complete', {
          userId,
          latencyMs: prefLatency,
          interactions: userPreferences.totalInteractions,
          confidence: userPreferences.overallConfidence,
          favoriteColors: userPreferences.colors.favoriteColors.length,
          topStyles: userPreferences.styles.topStyles.length,
        });
        logger.metric('recommend.personalization_fetch_ms', prefLatency, { requestId, userId });
      } catch (prefError) {
        reqLogger.warn('recommend.personalization.fetch_failed', {
          userId,
          reason: 'preference_fetch_error',
          error: prefError,
        });
        // Continue without personalization
      }
    }

    // Step 1: Analyze via Gemini/Groq flow with timeout (now personalized!)
    const analysisStart = Date.now();
    let analysis;
    try {
      analysis = await withTimeout(
        analyzeImageAndProvideRecommendations({ 
          photoDataUri, 
          occasion: occasion || '', 
          genre: genre || '', 
          gender, 
          weather: weather || '', 
          skinTone: skinTone || '', 
          dressColors: Array.isArray(dressColors) ? dressColors.join(', ') : (dressColors || ''), 
          previousRecommendation: previousRecommendation || '',
          userId: userId || '', // Pass userId to enable personalization in AI flow
        }),
        15000, // 15 second timeout for AI analysis
        'AI analysis timed out after 15 seconds'
      );
      const analysisLatency = Date.now() - analysisStart;
      reqLogger.info('recommend.analysis.complete', {
        provider: 'genkit',
        latencyMs: analysisLatency,
        recommendationCount: analysis.outfitRecommendations.length,
      });
      logger.metric('recommend.analysis_ms', analysisLatency, { requestId, provider: 'genkit' });
    } catch (analysisError) {
      reqLogger.error('recommend.analysis.failed', {
        reason: 'analysis_timeout_or_provider_error',
        error: analysisError,
      });
      throw new Error('Failed to analyze image. Please try again with a clearer photo.');
    }

    // Step 2: Process outfits — text/palettes first, images in PARALLEL with budget cap
    const outfitsStart = Date.now();
    const outfitsToProcess = analysis.outfitRecommendations.slice(0, 3);
    
    logger.log('🔄 [PERF] Processing outfits with PARALLEL image generation (15s budget)...');
    
    // First: extract all text data instantly (no async needed)
    type RecommendationOutfit = AnalyzeImageAndProvideRecommendationsOutput['outfitRecommendations'][number];
    type EnrichedOutfit = RecommendationOutfit & {
      imageUrl: string | null;
      generatedImageColors: unknown;
      shoppingLinks: {
        amazon: string | null;
        myntra: string | null;
        tatacliq: string | null;
      };
      _imagePrompt?: string;
      _colorHexCodes?: string[];
    };

    let enrichedOutfits: EnrichedOutfit[] = outfitsToProcess.map((outfit: RecommendationOutfit) => {
      const colorHexCodes = outfit.colorPalette?.map((c) => {
        if (typeof c === 'string') return c;
        const colorObj = c as { hex?: string; name?: string };
        return colorObj.hex || '#000000';
      }) || [];

      const shoppingLinksData = generateShoppingLinks({
        gender,
        items: outfit.items,
        colorPalette: colorHexCodes.slice(0, 5),
        style: outfit.styleType || 'casual',
        description: outfit.description
      });

      const shoppingLinks = {
        amazon: shoppingLinksData.byPlatform.amazon[0]?.url || null,
        myntra: shoppingLinksData.byPlatform.myntra[0]?.url || null,
        tatacliq: shoppingLinksData.byPlatform.tataCliq[0]?.url || null,
      };

      return {
        ...outfit,
        imageUrl: null, // Will be filled by parallel image gen
        colorPalette: colorHexCodes.slice(0, 5),
        generatedImageColors: null,
        shoppingLinks,
        _imagePrompt: outfit.imagePrompt || `${outfit.title} ${outfit.items.join(' ')}`,
        _colorHexCodes: colorHexCodes,
      };
    });

    logger.log(`⏱️ [PERF] Text/palettes/shopping ready in ${Date.now() - outfitsStart}ms`);

    // Second: generate images IN PARALLEL — all outfits fire simultaneously
    // Pollinations is the primary/only provider, so parallel is safe and much faster
    // Total time = slowest single image (~8s) instead of sum of all (~25s)
    const IMAGE_BUDGET = 12_000; // 12 s — klein model: 3.5s avg, all 3 parallel within this window
    const imageStart = Date.now();

    logger.log(`🎨 [IMAGES] Starting PARALLEL image generation for ${enrichedOutfits.length} outfits (${IMAGE_BUDGET / 1000}s budget)...`);

    const imagePromises = enrichedOutfits.map(async (outfit, i) => {
      const outfitNumber = i + 1;
      const prompt = outfit._imagePrompt || '';
      const colorHexCodes = outfit._colorHexCodes || [];
      try {
        // Check image cache first
        const cachedImageUrl = await getCachedImage(prompt, colorHexCodes);
        if (cachedImageUrl) {
          logger.log(`✅ [OUTFIT ${outfitNumber}] Using cached image`);
          const { _imagePrompt, _colorHexCodes, ...cleanOutfit } = outfit;
          return { ...cleanOutfit, imageUrl: cachedImageUrl };
        }

        logger.log(`🎨 [OUTFIT ${outfitNumber}] Starting image generation...`);
        const url = await generateImageWithRetry(prompt, colorHexCodes, IMAGE_BUDGET);
        const elapsed = Date.now() - imageStart;
        logger.log(`✅ [OUTFIT ${outfitNumber}] Image ready in ${elapsed}ms`);

        // Cache non-placeholder images
        const isSvgPlaceholder = url.startsWith('data:image/svg+xml');
        const isPlaceholderUrl = url.includes('via.placeholder.com');
        if (!isSvgPlaceholder && !isPlaceholderUrl) {
          cacheImage(prompt, colorHexCodes, url).catch(() => {});
        }

        const { _imagePrompt, _colorHexCodes, ...cleanOutfit } = outfit;
        return { ...cleanOutfit, imageUrl: url };
      } catch (err: any) {
        logger.warn(`⚠️ [OUTFIT ${outfitNumber}] Image failed: ${err.message}`);
        const { _imagePrompt, _colorHexCodes, ...cleanOutfit } = outfit;
        return { ...cleanOutfit, imageUrl: createFallbackPlaceholder(prompt, colorHexCodes) };
      }
    });

    // Wait for all images with a hard budget cap
    const settled = await Promise.race([
      Promise.all(imagePromises),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), IMAGE_BUDGET)),
    ]);

    if (settled) {
      enrichedOutfits = settled as typeof enrichedOutfits;
    } else {
      // Budget expired — fill any remaining with placeholders
      logger.warn(`⏱️ [IMAGES] Budget expired (${IMAGE_BUDGET}ms) — using placeholders for remaining`);
      enrichedOutfits = enrichedOutfits.map((outfit) => {
        if (outfit.imageUrl) return outfit;
        const { _imagePrompt, _colorHexCodes, ...cleanOutfit } = outfit;
        return { ...cleanOutfit, imageUrl: createFallbackPlaceholder(outfit._imagePrompt || '', outfit._colorHexCodes || []) };
      });
    }

    logger.log(`⏱️ [PERF] All outfits processed: ${Date.now() - outfitsStart}ms`);
    logger.log('✅ All outfits processed!');

    // ✨ Apply diversification if user is authenticated and has preferences
    if (userId && userId !== 'anonymous' && userPreferences && userBlocklists) {
      logger.log('🎯 [Diversification] Applying 70-20-10 rule...');
      
      try {
        // Calculate match scores for all outfits
        const outfitMatches = enrichedOutfits.map(outfit =>
          calculateOutfitMatchScore(outfit, userPreferences, userBlocklists)
        );

        // Apply 70-20-10 diversification
        const diversified = applyDiversificationRule(outfitMatches);

        // Check for pattern lock
        const patternLock = await detectPatternLock(userId, userPreferences);
        if (patternLock.isLocked) {
          logger.log('⚠️ Pattern lock detected! User stuck in style bubble. Forcing exploration.');
        }

        // Replace enrichedOutfits with diversified ones
        enrichedOutfits = diversified.map((match, index) => ({
          ...match.outfit,
          matchScore: match.matchScore,
          matchCategory: match.matchCategory,
          explanation: match.explanation,
          position: index + 1,
        }));

        logger.log('✅ [Diversification] Applied:', {
          position1: diversified[0]?.matchScore,
          position2: diversified[1]?.matchScore,
          position3: diversified[2]?.matchScore,
          patternLocked: patternLock.isLocked,
        });

        // Add first outfit to anti-repetition cache
        if (enrichedOutfits.length > 0) {
          await addToAntiRepetitionCache(userId, enrichedOutfits[0]);
          logger.log('✅ [Diversification] Added to anti-repetition cache');
        }
      } catch (divError) {
        logger.error('⚠️ [Diversification] Failed (non-critical):', divError);
        // Continue without diversification
      }
    }

    // ⚠️ REMOVED: Heavy color analysis that was adding 2-4s per outfit
    // Old code was running extractColorsFromUrl + optimized Tavily searches
    // Now using AI-generated colors directly for speed

    // ✨ NEW: Create interaction tracking session
    if (userId && userId !== 'anonymous') {
      logger.log('📊 [Interaction Tracking] Creating session...');
      
      try {
        await createInteractionSession(
          userId,
          sessionId,
          {
            occasion: occasion || 'casual',
            genre: genre || undefined,
            gender,
            weather: weather ? { temp: 0, condition: weather } : undefined,
          },
          enrichedOutfits.map((outfit, index) => ({
            position: index + 1,
            title: outfit.title,
            colors: Array.isArray(outfit.colorPalette) 
              ? outfit.colorPalette.map((c: unknown) => {
                  if (typeof c === 'string') return c;
                  if (typeof c === 'object' && c && 'hex' in c) {
                    const maybeHex = (c as { hex?: string }).hex;
                    return maybeHex || '#000000';
                  }
                  return '#000000';
                })
              : [],
            styles: outfit.styleType ? [outfit.styleType] : [],
            items: outfit.items || [],
            imageUrl: outfit.imageUrl || '',
            description: outfit.description,
          }))
        );
        
        logger.log('✅ [Interaction Tracking] Session created:', sessionId);
      } catch (trackError) {
        logger.error('⚠️ [Interaction Tracking] Failed to create session:', trackError);
      }
    }

    const payload = {
      userId: userId || 'anonymous',
      timestamp: Date.now(),
      occasion,
      genre,
      gender,
      weather,
      skinTone,
      dressColors,
      sessionId, // Include session ID for frontend tracking
      // PRIVACY: photoDataUri is NOT stored - only metadata
      analysis: { ...analysis, outfitRecommendations: enrichedOutfits },
    };

    // Skip Firestore save during generation for speed - do it async after response
    // This can be done client-side or in a background job
    let recommendationId: string | null = null;
    if (userId && userId !== 'anonymous') {
      // Fire and forget with proper error handling to prevent unhandled rejections
      saveRecommendation(userId, payload)
        .then(id => {
          logger.log(`✅ [ASYNC] Recommendation saved: ${id}`);
        })
        .catch(err => {
          logger.error('⚠️ [ASYNC] Save failed:', err);
        });
    }

    const totalTime = Date.now() - startTime;
    reqLogger.info('recommend.request.complete', {
      userId: userId || 'anonymous',
      latencyMs: totalTime,
      provider: 'genkit',
      imageProvider: 'pollinations',
      cacheSource: 'miss',
    });
    logger.metric('recommend.latency_ms', totalTime, {
      requestId,
      cacheSource: 'miss',
      provider: 'genkit',
    });

    const response = { 
      success: true, 
      payload,
      recommendationId,
      performanceMs: totalTime,
      cached: false,
      imageHash, // Include for deduplication
    };

    // 🚀 OPTIMIZATION 6: Store in Firestore cache for future similar requests (1 hour TTL)
    await firestoreCache.set(cacheParams, response, 3600);
    logger.log(`✅ [FIRESTORE CACHE] Result stored for 1 hour`);

    return NextResponse.json(response);
  } catch (err: any) {
    const totalTime = Date.now() - startTime;
    reqLogger.error('recommend.request.failed', {
      reason: err instanceof Error ? err.message : 'unknown_error',
      latencyMs: totalTime,
      error: err,
    });
    logger.metric('recommend.failure_latency_ms', totalTime, { requestId });

    
    // Detailed error logging
    if (err instanceof Error) {
      logger.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    }

    return NextResponse.json({ 
      error: sanitizeErrorMessage(err?.message || 'Failed to generate recommendations. Please try again.'),
      details: 'An unexpected error occurred while processing your request.'
    }, { status: 500 });
  }
}
