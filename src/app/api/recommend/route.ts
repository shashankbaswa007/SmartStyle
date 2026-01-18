import { NextResponse } from 'next/server';
import { analyzeImageAndProvideRecommendations } from '@/ai/flows/analyze-image-and-provide-recommendations';
import { generateOutfitImage } from '@/ai/flows/generate-outfit-image';
import { extractColorsFromUrl } from '@/lib/color-extraction';
import tavilySearch from '@/lib/tavily';
import saveRecommendation from '@/lib/firestoreRecommendations';
import { withTimeout } from '@/lib/timeout-utils';
import crypto from 'crypto';
import { getComprehensivePreferences } from '@/lib/preference-engine';
import { getBlocklists } from '@/lib/blocklist-manager';
import { generateSessionId, createInteractionSession } from '@/lib/interaction-tracker';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { recommendationCache, createCacheKey } from '@/lib/request-cache';
import { 
  calculateOutfitMatchScore, 
  applyDiversificationRule, 
  getAntiRepetitionCache, 
  addToAntiRepetitionCache,
  detectPatternLock 
} from '@/lib/recommendation-diversifier';

export async function POST(req: Request) {
  const startTime = Date.now();
  logger.log('⏱️ [PERF] API request started at', new Date().toISOString());
  
  // Rate limiting: 10 requests per minute per client
  const clientId = getClientIdentifier(req);
  const rateLimit = checkRateLimit(clientId, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  });

  if (!rateLimit.success) {
    const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
    return NextResponse.json(
      { 
        error: 'Too many requests. Please try again later.',
        retryAfter,
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }
  
  try {
    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      logger.error('❌ Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { photoDataUri, occasion, genre, gender, weather, skinTone, dressColors, previousRecommendation, userId } = body;

    // Validate required fields
    if (!photoDataUri) {
      return NextResponse.json(
        { error: 'Photo data is required' },
        { status: 400 }
      );
    }

    if (!gender) {
      return NextResponse.json(
        { error: 'Gender is required' },
        { status: 400 }
      );
    }

    logger.log('🎯 Starting recommendation flow:', {
      hasPhoto: !!photoDataUri,
      occasion: occasion || 'not specified',
      gender,
      hasUserId: !!userId,
    });

    // Generate cache key from image hash and preferences
    const imageHash = crypto
      .createHash('sha256')
      .update(photoDataUri)
      .digest('hex')
      .substring(0, 16);
    
    const cacheKey = createCacheKey('recommend', {
      imageHash,
      occasion,
      gender,
      weather: weather || 'any',
      userId: userId || 'anonymous',
    });
    logger.log('🔑 [PERF] Cache key:', cacheKey);

    // ✨ Check cache first to avoid expensive AI calls
    const cachedResult = recommendationCache.get(cacheKey);
    if (cachedResult) {
      const totalTime = Date.now() - startTime;
      logger.log(`✅ [CACHE HIT] Returning cached result (saved ${totalTime}ms)`);
      logger.log(`📊 [CACHE STATS] Hit rate: ${(recommendationCache.getHitRate() * 100).toFixed(1)}%`);
      
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        performanceMs: totalTime,
      });
    }
    
    logger.log('❌ [CACHE MISS] Proceeding with AI generation...');

    // ✨ NEW: Fetch user preferences and blocklists for personalization
    let userPreferences = null;
    let userBlocklists = null;
    let sessionId = generateSessionId();
    
    if (userId && userId !== 'anonymous') {
      logger.log('🎨 [Personalization] Fetching user preferences...');
      const prefStart = Date.now();
      
      try {
        [userPreferences, userBlocklists] = await Promise.all([
          getComprehensivePreferences(userId),
          getBlocklists(userId),
        ]);
        
        logger.log(`⏱️ [PERF] Preferences fetched: ${Date.now() - prefStart}ms`);
        logger.log('✅ [Personalization] User profile loaded:', {
          interactions: userPreferences.totalInteractions,
          confidence: userPreferences.overallConfidence,
          favoriteColors: userPreferences.colors.favoriteColors.length,
          topStyles: userPreferences.styles.topStyles.length,
        });
      } catch (prefError) {
        logger.error('⚠️ [Personalization] Failed to fetch preferences:', prefError);
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
          occasion, 
          genre, 
          gender, 
          weather, 
          skinTone, 
          dressColors, 
          previousRecommendation,
          userId, // Pass userId to enable personalization in AI flow
        }),
        15000, // 15 second timeout for AI analysis
        'AI analysis timed out after 15 seconds'
      );
      logger.log(`⏱️ [PERF] Analysis completed: ${Date.now() - analysisStart}ms`);
      logger.log('✅ Image analysis complete:', analysis.outfitRecommendations.length, 'recommendations');
    } catch (analysisError) {
      logger.error('❌ Image analysis failed:', analysisError);
      throw new Error('Failed to analyze image. Please try again with a clearer photo.');
    }

    // Step 2: Process ALL 3 outfits in PARALLEL (NOT sequential!)
    const outfitsStart = Date.now();
    const outfitsToProcess = analysis.outfitRecommendations.slice(0, 3);
    
    logger.log('🚀 [PERF] Processing 3 outfits in PARALLEL...');
    
    let enrichedOutfits = await Promise.all(
      outfitsToProcess.map(async (outfit, index) => {
        const outfitStart = Date.now();
        const outfitNumber = index + 1;
        logger.log(`⚡ [PERF] Starting outfit ${outfitNumber}/3`);

        try {
          // Extract color hex codes
          const colorHexCodes = outfit.colorPalette?.map(c => {
            if (typeof c === 'string') return c;
            const colorObj = c as { hex?: string; name?: string };
            return colorObj.hex || '#000000';
          }) || [];

          // STEP 1: Generate image first
          const imageUrl = await withTimeout(
            generateOutfitImage(
              outfit.imagePrompt || `${outfit.title} ${outfit.items.join(' ')}`,
              colorHexCodes
            ),
            10000, // 10 second timeout
            `Outfit ${outfitNumber} image generation timed out`
          ) as string;

          logger.log(`✅ [OUTFIT ${outfitNumber}] Image generated`);

          // STEP 2: Extract ACTUAL colors from generated image for accurate shopping
          let extractedColors: any = null;
          try {
            extractedColors = await withTimeout(
              extractColorsFromUrl(imageUrl),
              5000, // 5 second timeout for color extraction
              `Color extraction timeout`
            );
            logger.log(`✅ [OUTFIT ${outfitNumber}] Extracted ${extractedColors.dominantColors.length} colors from generated image`);
          } catch (colorError) {
            logger.warn(`⚠️ [OUTFIT ${outfitNumber}] Color extraction failed, using AI colors:`, (colorError as Error).message);
          }

          // Use extracted colors from image if available, otherwise fallback to AI colors
          const accurateColorPalette = extractedColors?.dominantColors?.slice(0, 5) || outfit.colorPalette || [];
          
          // STEP 3: Search for shopping links using ACTUAL image colors
          const shoppingLinks = await withTimeout(
            tavilySearch(
              `${outfit.title} ${outfit.items.join(' ')}`,
              accurateColorPalette,
              gender,
              occasion,
              outfit.styleType,
              outfit.items[0]
            ),
            8000, // 8 second timeout for shopping
            `Shopping search timeout`
          );

          logger.log(`⏱️ [PERF] Outfit ${outfitNumber} completed: ${Date.now() - outfitStart}ms`);

          // Return outfit with accurate colors and matching shopping links
          return {
            ...outfit,
            imageUrl,
            colorPalette: accurateColorPalette,
            generatedImageColors: extractedColors?.colorPalette?.slice(0, 6) || null,
            shoppingLinks
          };

        } catch (error: any) {
          logger.error(`❌ Outfit ${outfitNumber} failed:`, error.message);
          logger.log(`⏱️ [PERF] Outfit ${outfitNumber} failed after: ${Date.now() - outfitStart}ms`);
          
          return {
            ...outfit,
            imageUrl: `https://via.placeholder.com/800x1000/6366f1/ffffff?text=${encodeURIComponent('Image unavailable')}`,
            colorPalette: outfit.colorPalette || [],
            generatedImageColors: null,
            shoppingLinks: { amazon: null, tatacliq: null, myntra: null },
            error: error.message || 'Generation failed'
          };
        }
      })
    );

    logger.log(`⏱️ [PERF] All outfits processed in parallel: ${Date.now() - outfitsStart}ms`);
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
            occasion,
            genre,
            gender,
            weather: weather ? { temp: 0, condition: weather } : undefined,
          },
          enrichedOutfits.map((outfit, index) => ({
            position: index + 1,
            title: outfit.title,
            colors: Array.isArray(outfit.colorPalette) 
              ? outfit.colorPalette.map((c: any) => typeof c === 'string' ? c : c.hex || '#000000')
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
      // Fire and forget - don't wait for save
      saveRecommendation(userId, payload)
        .then(id => logger.log(`✅ [ASYNC] Recommendation saved: ${id}`))
        .catch(err => logger.error('⚠️ [ASYNC] Save failed:', err));
    }

    const totalTime = Date.now() - startTime;
    logger.log(`⏱️ [PERF] ============================================`);
    logger.log(`⏱️ [PERF] TOTAL API TIME: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    logger.log(`⏱️ [PERF] ============================================`);

    const response = { 
      success: true, 
      payload,
      recommendationId,
      performanceMs: totalTime,
      cached: false
    };

    // ✨ Store in cache for future requests (5 minute TTL)
    recommendationCache.set(cacheKey, response);
    logger.log(`✅ [CACHE] Result stored for 5 minutes`);
    logger.log(`📊 [CACHE STATS] Size: ${recommendationCache.getStats().size}, Hit rate: ${(recommendationCache.getHitRate() * 100).toFixed(1)}%`);

    return NextResponse.json(response);
  } catch (err: any) {
    const totalTime = Date.now() - startTime;
    logger.error('❌ Recommend route error:', err);
    logger.log(`⏱️ [PERF] Failed after ${totalTime}ms`); 

    
    // Detailed error logging
    if (err instanceof Error) {
      logger.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    }

    return NextResponse.json({ 
      error: err?.message || 'Failed to generate recommendations. Please try again.',
      details: 'An unexpected error occurred while processing your request.'
    }, { status: 500 });
  }
}
