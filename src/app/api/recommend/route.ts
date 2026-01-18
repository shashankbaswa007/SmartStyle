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

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log('⏱️ [PERF] API request started at', new Date().toISOString());
  
  try {
    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
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

    console.log('🎯 Starting recommendation flow:', {
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
    
    const cacheKey = `rec:${imageHash}:${occasion}:${gender}:${weather || 'any'}`;
    console.log('🔑 [PERF] Cache key:', cacheKey);

    // ✨ NEW: Fetch user preferences and blocklists for personalization
    let userPreferences = null;
    let userBlocklists = null;
    let sessionId = generateSessionId();
    
    if (userId && userId !== 'anonymous') {
      console.log('🎨 [Personalization] Fetching user preferences...');
      const prefStart = Date.now();
      
      try {
        [userPreferences, userBlocklists] = await Promise.all([
          getComprehensivePreferences(userId),
          getBlocklists(userId),
        ]);
        
        console.log(`⏱️ [PERF] Preferences fetched: ${Date.now() - prefStart}ms`);
        console.log('✅ [Personalization] User profile loaded:', {
          interactions: userPreferences.totalInteractions,
          confidence: userPreferences.overallConfidence,
          favoriteColors: userPreferences.colors.favoriteColors.length,
          topStyles: userPreferences.styles.topStyles.length,
        });
      } catch (prefError) {
        console.error('⚠️ [Personalization] Failed to fetch preferences:', prefError);
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
      console.log(`⏱️ [PERF] Analysis completed: ${Date.now() - analysisStart}ms`);
      console.log('✅ Image analysis complete:', analysis.outfitRecommendations.length, 'recommendations');
    } catch (analysisError) {
      console.error('❌ Image analysis failed:', analysisError);
      throw new Error('Failed to analyze image. Please try again with a clearer photo.');
    }

    // Step 2: Process ALL 3 outfits in PARALLEL (NOT sequential!)
    const outfitsStart = Date.now();
    const outfitsToProcess = analysis.outfitRecommendations.slice(0, 3);
    
    console.log('🚀 [PERF] Processing 3 outfits in PARALLEL...');
    
    const enrichedOutfits = await Promise.all(
      outfitsToProcess.map(async (outfit, index) => {
        const outfitStart = Date.now();
        const outfitNumber = index + 1;
        console.log(`⚡ [PERF] Starting outfit ${outfitNumber}/3`);

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

          console.log(`✅ [OUTFIT ${outfitNumber}] Image generated`);

          // STEP 2: Extract ACTUAL colors from generated image for accurate shopping
          let extractedColors: any = null;
          try {
            extractedColors = await withTimeout(
              extractColorsFromUrl(imageUrl),
              5000, // 5 second timeout for color extraction
              `Color extraction timeout`
            );
            console.log(`✅ [OUTFIT ${outfitNumber}] Extracted ${extractedColors.dominantColors.length} colors from generated image`);
          } catch (colorError) {
            console.warn(`⚠️ [OUTFIT ${outfitNumber}] Color extraction failed, using AI colors:`, (colorError as Error).message);
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

          console.log(`⏱️ [PERF] Outfit ${outfitNumber} completed: ${Date.now() - outfitStart}ms`);

          // Return outfit with accurate colors and matching shopping links
          return {
            ...outfit,
            imageUrl,
            colorPalette: accurateColorPalette,
            generatedImageColors: extractedColors?.colorPalette?.slice(0, 6) || null,
            shoppingLinks
          };

        } catch (error: any) {
          console.error(`❌ Outfit ${outfitNumber} failed:`, error.message);
          console.log(`⏱️ [PERF] Outfit ${outfitNumber} failed after: ${Date.now() - outfitStart}ms`);
          
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

    console.log(`⏱️ [PERF] All outfits processed in parallel: ${Date.now() - outfitsStart}ms`);
    console.log('✅ All outfits processed!');

    // ⚠️ REMOVED: Heavy color analysis that was adding 2-4s per outfit
    // Old code was running extractColorsFromUrl + optimized Tavily searches
    // Now using AI-generated colors directly for speed

    // ✨ NEW: Create interaction tracking session
    if (userId && userId !== 'anonymous') {
      console.log('📊 [Interaction Tracking] Creating session...');
      
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
        
        console.log('✅ [Interaction Tracking] Session created:', sessionId);
      } catch (trackError) {
        console.error('⚠️ [Interaction Tracking] Failed to create session:', trackError);
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
        .then(id => console.log(`✅ [ASYNC] Recommendation saved: ${id}`))
        .catch(err => console.error('⚠️ [ASYNC] Save failed:', err));
    }

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ [PERF] ============================================`);
    console.log(`⏱️ [PERF] TOTAL API TIME: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    console.log(`⏱️ [PERF] ============================================`);

    return NextResponse.json({ 
      success: true, 
      payload,
      recommendationId,
      performanceMs: totalTime,
      cached: false
    });
  } catch (err: any) {
    const totalTime = Date.now() - startTime;
    console.error('❌ Recommend route error:', err);
    console.log(`⏱️ [PERF] Failed after ${totalTime}ms`); 

    
    // Detailed error logging
    if (err instanceof Error) {
      console.error('Error details:', {
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
