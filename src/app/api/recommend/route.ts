import { NextResponse } from 'next/server';
import { analyzeImageAndProvideRecommendations } from '@/ai/flows/analyze-image-and-provide-recommendations';
import { generateOutfitImage } from '@/ai/flows/generate-outfit-image';
import { analyzeGeneratedImage } from '@/ai/flows/analyze-generated-image';
import tavilySearch from '@/lib/tavily';
import saveRecommendation from '@/lib/firestoreRecommendations';

export async function POST(req: Request) {
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

    // Step 1: Analyze via Gemini flow
    let analysis;
    try {
      analysis = await analyzeImageAndProvideRecommendations({ 
        photoDataUri, 
        occasion, 
        genre, 
        gender, 
        weather, 
        skinTone, 
        dressColors, 
        previousRecommendation 
      });
      console.log('✅ Image analysis complete:', analysis.outfitRecommendations.length, 'recommendations');
    } catch (analysisError) {
      console.error('❌ Image analysis failed:', analysisError);
      throw new Error('Failed to analyze image. Please try again with a clearer photo.');
    }

    // Step 2: Process all outfits IN PARALLEL for maximum speed
    console.log('⚡ Processing all outfits in parallel for maximum speed...');
    
    const enrichedOutfits = await Promise.all(
      analysis.outfitRecommendations.slice(0, 3).map(async (outfit, index) => {
        const outfitNumber = index + 1;
        console.log(`⚡ Processing outfit ${outfitNumber}/3 in parallel`);

        try {
          // Extract color hex codes
          const colorHexCodes = outfit.colorPalette?.map(c => {
            if (typeof c === 'string') return c;
            const colorObj = c as { hex?: string; name?: string };
            return colorObj.hex || '#000000';
          }) || [];

          // Generate image
          const imageUrl = await generateOutfitImage(
            outfit.imagePrompt || `${outfit.title} ${outfit.items.join(' ')}`,
            colorHexCodes
          );
          console.log(`✅ Image ${outfitNumber} generated: ${imageUrl.substring(0, 50)}...`);

          // Check if placeholder (skip Gemini analysis for placeholders)
          const isPlaceholder = imageUrl.includes('placeholder');

          if (!isPlaceholder) {
            console.log(`🔍 Running Gemini analysis + Tavily search in parallel for outfit ${outfitNumber}...`);

            // Run Gemini analysis AND initial Tavily search in PARALLEL
            const initialQuery = `${outfit.title} ${outfit.items.join(' ')}`;
            const outfitDescription = outfit.description || outfit.title;
            const [geminiResult, initialLinksResult] = await Promise.allSettled([
              analyzeGeneratedImage(imageUrl, outfit.title, outfitDescription, outfit.items, gender),
              tavilySearch(
                initialQuery, 
                outfit.colorPalette || [], 
                gender, 
                occasion,
                outfit.styleType,
                outfit.items[0] // First item as clothing type
              )
            ]);

            // Extract Gemini analysis if successful
            const geminiAnalysis = geminiResult.status === 'fulfilled' ? geminiResult.value : null;

            if (geminiAnalysis) {
              console.log(`✅ Gemini analysis complete for outfit ${outfitNumber}`);
              console.log(`🎨 Gemini extracted colors:`, geminiAnalysis.dominantColors.length);
              console.log(`🔍 Gemini query:`, geminiAnalysis.shoppingQuery);

              // Use Gemini's optimized query to re-search
              try {
                // Convert Gemini's color objects to hex strings for Tavily
                const colorHexStrings = geminiAnalysis.dominantColors.map(c => c.hex);
                
                const optimizedLinks = await tavilySearch(
                  geminiAnalysis.shoppingQuery, 
                  colorHexStrings,
                  gender,
                  occasion,
                  outfit.styleType,
                  outfit.items[0] // First item as clothing type
                );
                console.log(`✅ Optimized Tavily search complete for outfit ${outfitNumber}`);

                return {
                  ...outfit,
                  imageUrl,
                  colorPalette: geminiAnalysis.dominantColors,
                  detailedDescription: geminiAnalysis.detailedDescription || outfit.title,
                  shoppingLinks: optimizedLinks,
                };
              } catch (retryError) {
                console.error(`⚠️ Optimized Tavily search failed for outfit ${outfitNumber}, using initial results`);
                const initialLinks = initialLinksResult.status === 'fulfilled' 
                  ? initialLinksResult.value 
                  : { amazon: null, tatacliq: null, myntra: null };

                return {
                  ...outfit,
                  imageUrl,
                  colorPalette: geminiAnalysis.dominantColors,
                  detailedDescription: geminiAnalysis.detailedDescription || outfit.title,
                  shoppingLinks: initialLinks,
                };
              }
            } else {
              console.log(`⚠️ Gemini analysis failed for outfit ${outfitNumber}, using initial results`);
              const initialLinks = initialLinksResult.status === 'fulfilled' 
                ? initialLinksResult.value 
                : { amazon: null, tatacliq: null, myntra: null };

              return {
                ...outfit,
                imageUrl,
                shoppingLinks: initialLinks,
              };
            }
          } else {
            // Placeholder image - just get shopping links
            console.log(`⚠️ Outfit ${outfitNumber} is placeholder, skipping Gemini analysis`);
            try {
              const query = `${outfit.title} ${outfit.items.join(' ')}`;
              const links = await tavilySearch(
                query, 
                outfit.colorPalette || [], 
                gender, 
                occasion,
                outfit.styleType,
                outfit.items[0] // First item as clothing type
              );
              return {
                ...outfit,
                imageUrl,
                shoppingLinks: links,
              };
            } catch (linkError) {
              console.error(`⚠️ Shopping links failed for outfit ${outfitNumber}:`, linkError);
              return {
                ...outfit,
                imageUrl,
                shoppingLinks: { amazon: null, tatacliq: null, myntra: null },
              };
            }
          }
        } catch (outfitError) {
          console.error(`❌ Failed to process outfit ${outfitNumber}:`, outfitError);
          return {
            ...outfit,
            imageUrl: 'https://via.placeholder.com/800x1000/6366f1/ffffff?text=Fashion+Outfit',
            shoppingLinks: { amazon: null, tatacliq: null, myntra: null },
          };
        }
      })
    );

    console.log('✅ All outfits processed in parallel!');

    const payload = {
      userId: userId || 'anonymous',
      timestamp: Date.now(),
      occasion,
      genre,
      gender,
      weather,
      skinTone,
      dressColors,
      // PRIVACY: photoDataUri is NOT stored - only metadata
      analysis: { ...analysis, outfitRecommendations: enrichedOutfits },
    };

    // Step 5: Persist recommendation metadata if userId present
    let recommendationId: string | null = null;
    if (userId && userId !== 'anonymous') {
      try {
        recommendationId = await saveRecommendation(userId, payload);
        console.log(`✅ Recommendation saved with ID: ${recommendationId}`);
      } catch (saveError) {
        console.error('⚠️ Failed to save recommendation metadata:', saveError);
        // Don't fail the entire request if saving fails
      }
    } else {
      console.log('ℹ️ Anonymous user - recommendation not saved to database');
    }

    return NextResponse.json({ 
      success: true, 
      payload,
      recommendationId 
    });
  } catch (err: any) {
    console.error('❌ Recommend route error:', err);
    
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
