import { NextResponse } from 'next/server';
import { analyzeImageAndProvideRecommendations } from '@/ai/flows/analyze-image-and-provide-recommendations';
import { generateOutfitImage } from '@/ai/flows/generate-outfit-image';
import { extractColorsFromUrl } from '@/lib/color-extraction';
import { generateShoppingLinks, validateShoppingLinks } from '@/lib/shopping-link-generator';
import saveRecommendation from '@/lib/firestoreRecommendations';
import { withTimeout } from '@/lib/timeout-utils';
import crypto from 'crypto';
import { getComprehensivePreferences } from '@/lib/preference-engine';
import { getBlocklists } from '@/lib/blocklist-manager';
import { generateSessionId, createInteractionSession } from '@/lib/interaction-tracker';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter';
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
import pLimit from 'p-limit';
import { FirestoreCache } from '@/lib/firestore-cache';
import { checkDuplicateImage, generateImageHash } from '@/lib/image-deduplication';
import { checkRateLimit as checkFirestoreRateLimit } from '@/lib/firestore-rate-limiter';
import { generateImageWithRetry } from '@/lib/smart-image-generation';

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
  logger.log('⏱️ [PERF] API request started at', new Date().toISOString());
  
  try {
    // Parse and validate request body with Zod
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

    // Validate request body against schema
    const validation = validateRequest(recommendRequestSchema, body);
    if (!validation.success) {
      logger.error('❌ Validation failed:', validation.error);
      return NextResponse.json(
        formatValidationError(validation.error),
        { status: 400 }
      );
    }

    // Use validated data (type-safe!)
    const { photoDataUri, occasion, genre, gender, weather, skinTone, dressColors, previousRecommendation, userId } = validation.data;

    // Additional server-side security validation for image
    const imageValidation = quickValidateImageDataUri(photoDataUri);
    if (!imageValidation.isValid) {
      logger.error('❌ Image validation failed:', imageValidation.error);
      return NextResponse.json(
        { error: imageValidation.error },
        { status: 400 }
      );
    }

    // 🚀 OPTIMIZATION 1: Firestore Rate Limiting (20 req/hour per user)
    const effectiveUserId = userId || 'anonymous';
    const rateLimitCheck = await checkFirestoreRateLimit(effectiveUserId);
    
    if (!rateLimitCheck.allowed) {
      logger.warn(`⚠️ Rate limit exceeded for user ${effectiveUserId}`);
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
    
    logger.log(`✅ Rate limit OK: ${rateLimitCheck.remaining} requests remaining`);

    logger.log('🎯 Starting recommendation flow:', {
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
        logger.log('🎯 Returning duplicate image result from 24h history');
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
      logger.log(`✅ [FIRESTORE CACHE HIT] Returning cached result (saved ~10s and API calls!)`);
      
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        cacheSource: 'firestore',
        performanceMs: totalTime,
        message: 'Results from recent similar request (saves your rate limit)',
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
      logger.log(`⏱️ [PERF] Analysis completed: ${Date.now() - analysisStart}ms`);
      logger.log('✅ Image analysis complete:', analysis.outfitRecommendations.length, 'recommendations');
    } catch (analysisError) {
      logger.error('❌ Image analysis failed:', analysisError);
      throw new Error('Failed to analyze image. Please try again with a clearer photo.');
    }

    // Step 2: Process outfits IN PARALLEL with controlled concurrency (2 concurrent max)
    const outfitsStart = Date.now();
    const outfitsToProcess = analysis.outfitRecommendations.slice(0, 3);
    
    logger.log('🔄 [PERF] Processing 3 outfits with PARALLEL processing (2 concurrent)...');
    
    // Create a concurrency limiter - max 2 outfits generating at once
    const limit = pLimit(2);
    
    let enrichedOutfits = await Promise.all(
      outfitsToProcess.map((outfit, index) =>
        limit(async () => {
          const outfitStart = Date.now();
          const outfitNumber = index + 1;
          logger.log(`⚡ [PERF] Starting outfit ${outfitNumber}/3`);

          // Track generated image URL across scopes
          let generatedImageUrl: string | null = null;

          try {
            // 🚀 OPTIMIZATION 4: Faster stagger (500ms instead of 1000ms)
            if (index > 0) {
              const delayMs = index * 500; // 500ms stagger (faster!)
              logger.log(`⏳ Staggered start: waiting ${delayMs}ms for outfit ${outfitNumber}...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            // Extract color hex codes from AI recommendation
            const colorHexCodes = outfit.colorPalette?.map(c => {
              if (typeof c === 'string') return c;
              const colorObj = c as { hex?: string; name?: string };
              return colorObj.hex || '#000000';
            }) || [];
            
            logger.log(`🎨 Using AI-generated color palette: ${colorHexCodes.join(', ')}`);
            
            // 🚀 OPTIMIZATION 5: Smart image generation with retry logic
            generatedImageUrl = await generateImageWithRetry(
              outfit.imagePrompt || `${outfit.title} ${outfit.items.join(' ')}`,
              colorHexCodes,
              2 // Max 2 retries
            );
            logger.log(`✅ [OUTFIT ${outfitNumber}] Image generated`);

            // STEP 2: Try to extract colors from generated image (optional enhancement)
            // PRIMARY: Use AI colors (more reliable and match the recommendation)
            // SECONDARY: Extract from image (for validation/enhancement only)
            let extractedColors: any = null;
            try {
              extractedColors = await withTimeout(
                extractColorsFromUrl(generatedImageUrl),
                10000, // 10 second timeout
                `Color extraction timeout`
              );
              logger.log(`✅ [OUTFIT ${outfitNumber}] Extracted ${extractedColors.dominantColors.length} colors from generated image`);
            } catch (colorError) {
              logger.warn(`⚠️ [OUTFIT ${outfitNumber}] Color extraction failed, using AI colors:`, (colorError as Error).message);
            }

            // PRIMARY: Use AI colors (they match the recommendation text)
            // FALLBACK: Use extracted colors only if AI colors unavailable
            const accurateColorPalette = colorHexCodes.length > 0 
              ? colorHexCodes.slice(0, 5)
              : (extractedColors?.dominantColors?.slice(0, 5) || ['#000000', '#FFFFFF', '#808080']);
            
            logger.log(`🎨 Final color palette: ${accurateColorPalette.join(', ')}`);
            
            // STEP 3: Generate shopping links INSTANTLY using pattern-based URLs (< 5ms)
            const shoppingLinksData = generateShoppingLinks({
              gender,
              items: outfit.items,
              colorPalette: accurateColorPalette,
              style: outfit.styleType || 'casual',
              description: outfit.description
            });

            // Convert to expected format (take first link for each platform)
            const shoppingLinks = {
              amazon: shoppingLinksData.byPlatform.amazon[0]?.url || null,
              myntra: shoppingLinksData.byPlatform.myntra[0]?.url || null,
              tatacliq: shoppingLinksData.byPlatform.tataCliq[0]?.url || null,
            };

            logger.log(`⏱️ [PERF] Outfit ${outfitNumber} completed: ${Date.now() - outfitStart}ms`);

            // Return enriched outfit
            return {
              ...outfit,
              imageUrl: generatedImageUrl,
              colorPalette: accurateColorPalette,
              generatedImageColors: extractedColors?.colorPalette?.slice(0, 6) || null,
              shoppingLinks
            };

          } catch (error: any) {
            // Check if error is from shopping search timeout vs image generation
            const isShoppingError = error.message?.includes('Shopping search timeout');
            const isColorError = error.message?.includes('Color extraction timeout');
            
            if (isShoppingError || isColorError) {
              logger.warn(`⚠️ Outfit ${outfitNumber} - ${isShoppingError ? 'shopping' : 'color extraction'} failed but image OK`);
              // Image generated successfully, only secondary features failed
              return {
                ...outfit,
                imageUrl: generatedImageUrl || `https://via.placeholder.com/800x1000/6366f1/ffffff?text=${encodeURIComponent('Image unavailable')}`,
                colorPalette: outfit.colorPalette || ['#000000', '#FFFFFF', '#808080'],
                generatedImageColors: null,
                shoppingLinks: { amazon: null, tatacliq: null, myntra: null },
                shoppingError: isShoppingError ? 'Shopping links temporarily unavailable' : undefined
              };
            }
            
            logger.error(`❌ Outfit ${outfitNumber} failed:`, error.message);
            logger.log(`⏱️ [PERF] Outfit ${outfitNumber} failed after: ${Date.now() - outfitStart}ms`);
            
            // Return failed outfit with placeholder
            return {
              ...outfit,
              imageUrl: `https://via.placeholder.com/800x1000/6366f1/ffffff?text=${encodeURIComponent('Image unavailable')}`,
              colorPalette: outfit.colorPalette || ['#000000', '#FFFFFF', '#808080'],
              generatedImageColors: null,
              shoppingLinks: { amazon: null, tatacliq: null, myntra: null },
              error: error.message || 'Generation failed'
            };
          }
        })
      )
    );

    logger.log(`⏱️ [PERF] All outfits processed with parallel execution: ${Date.now() - outfitsStart}ms`);
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
      // Fire and forget with proper error handling to prevent unhandled rejections
      saveRecommendation(userId, payload)
        .then(id => {
          try {
            logger.log(`✅ [ASYNC] Recommendation saved: ${id}`);
          } catch (logError) {
            console.error('Logger error:', logError);
          }
        })
        .catch(err => {
          try {
            logger.error('⚠️ [ASYNC] Save failed:', err);
          } catch (logError) {
            console.error('Logger error:', logError);
          }
        });
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
      cached: false,
      imageHash, // Include for deduplication
    };

    // 🚀 OPTIMIZATION 6: Store in Firestore cache for future similar requests (1 hour TTL)
    await firestoreCache.set(cacheParams, response, 3600);
    logger.log(`✅ [FIRESTORE CACHE] Result stored for 1 hour`);

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
      error: sanitizeErrorMessage(err?.message || 'Failed to generate recommendations. Please try again.'),
      details: 'An unexpected error occurred while processing your request.'
    }, { status: 500 });
  }
}
