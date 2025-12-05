import { NextResponse } from 'next/server';
import { analyzeImageAndProvideRecommendations } from '@/ai/flows/analyze-image-and-provide-recommendations';
import { generateOutfitImage } from '@/ai/flows/generate-outfit-image';
import { analyzeGeneratedImage } from '@/ai/flows/analyze-generated-image';
import tavilySearch from '@/lib/tavily';
// No disk persistence by default — prefer in-memory buffers for speed and determinism
import saveRecommendation from '@/lib/firestoreRecommendations';
// Simple in-memory cache for tavily searches to avoid duplicate network calls
const tavilyCache: Map<string, { result: any; expiresAt: number }> = new Map();

// Fetch with timeout helper (default 6s)
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) {
  const timeout = init?.timeoutMs ?? 6000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(input, { ...(init || {}), signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(id);
  }
}

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

    // Step 2: Process outfits with controlled concurrency to avoid rate limits
    const CONCURRENCY = 2; // process up to 2 outfits at a time (tune this value as needed)
    console.log(`⚡ Processing outfits with concurrency=${CONCURRENCY} to reduce API rate pressure...`);

    // Disk persistence removed to reduce latency. The analyzer uses in-memory Buffers
    // passed directly to the color-extraction flow (node-vibrant) when available.

  // Allow configuration for how many outfits to process to trade quality for speed
  const maxOutfits = Number(process.env.SMARTSTYLE_MAX_OUTFITS || '3');
  const outfitsToProcess = analysis.outfitRecommendations.slice(0, maxOutfits);
    const enrichedOutfits: any[] = [];

    // Helper: process a single outfit and push result into enrichedOutfits in original order
    const processOutfit = async (outfit: any, index: number) => {
      const outfitNumber = index + 1;
      console.log(`⚡ Processing outfit ${outfitNumber}/3 (concurrent worker)`);
  // We use an in-memory Buffer for image bytes (no tmp file persistence)
        try {
          // Extract color hex codes
          const colorHexCodes = outfit.colorPalette?.map((c: any) => {
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

          // Attempt to fetch generated image bytes. Persisting to disk is optional and disabled by default to reduce latency.
          // To enable disk persistence (slower), set SMARTSTYLE_PERSIST_TMP=true in env.
          let localImageBuffer: Buffer | undefined = undefined;
          try {
            const resp = await fetchWithTimeout(imageUrl, { timeoutMs: 5000 });
            if (resp.ok) {
              const arrayBuf = await resp.arrayBuffer();
              localImageBuffer = Buffer.from(arrayBuf);

              console.log('ℹ️ Using in-memory buffer for Vibrant extraction (no disk persist)');
            } else {
              console.warn(`⚠️ Failed to fetch generated image for local persist: ${resp.status}`);
            }
          } catch (fetchErr) {
            console.warn('⚠️ Error fetching generated image for local persist:', fetchErr);
          }

          // Check if placeholder (skip Gemini analysis for placeholders)
          const isPlaceholder = imageUrl.includes('placeholder');

          if (!isPlaceholder) {
            console.log(`🔍 Running Gemini analysis + Tavily search in parallel for outfit ${outfitNumber}...`);

            // Run Gemini analysis AND initial Tavily search in PARALLEL. Use cached Tavily results when possible.
            const initialQuery = `${outfit.title} ${outfit.items.join(' ')}`;
            const outfitDescription = outfit.description || outfit.title;
            const tavilyCacheKey = JSON.stringify({ q: initialQuery, colors: outfit.colorPalette || [], gender, occasion, style: outfit.styleType });
            const now = Date.now();
            let initialLinksResultPromise: Promise<any>;
            const cached = tavilyCache.get(tavilyCacheKey);
            if (cached && cached.expiresAt > now) {
              initialLinksResultPromise = Promise.resolve(cached.result);
            } else {
              initialLinksResultPromise = tavilySearch(
                initialQuery, 
                outfit.colorPalette || [], 
                gender, 
                occasion,
                outfit.styleType,
                outfit.items[0]
              ).then((res) => {
                try {
                  tavilyCache.set(tavilyCacheKey, { result: res, expiresAt: Date.now() + 1000 * 60 * 10 }); // cache 10m
                } catch (e) {
                  // ignore cache failures
                }
                return res;
              });
            }

            const [geminiResult, initialLinksResult] = await Promise.allSettled([
              analyzeGeneratedImage(imageUrl, outfit.title, outfitDescription, outfit.items, gender, localImageBuffer),
              initialLinksResultPromise
            ]);

            // Extract Gemini analysis if successful
            const geminiAnalysis = geminiResult.status === 'fulfilled' ? geminiResult.value : null;

            if (geminiAnalysis) {
              console.log(`✅ Gemini analysis complete for outfit ${outfitNumber}`);
              console.log(`🎨 Gemini extracted colors:`, geminiAnalysis.dominantColors.length);
              console.log(`🔍 Gemini query:`, geminiAnalysis.shoppingQuery);

              // Use Gemini's optimized query to re-search
              // Prepare color hex strings in outer scope so catch can also use them
              let colorHexStrings: string[] = [];
              try {
                // Convert Gemini's color objects to hex strings for Tavily
                colorHexStrings = geminiAnalysis.dominantColors.map((c: any) => c.hex);
                
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
                  // Normalize colorPalette to array of hex strings (schema-friendly)
                  colorPalette: colorHexStrings,
                  // keep the rich analysis object under a separate field for UI/diagnostics
                  colorDetails: geminiAnalysis.dominantColors,
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
                  colorPalette: colorHexStrings,
                  colorDetails: geminiAnalysis.dominantColors,
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
        } finally {
          // No tmp files to cleanup when using in-memory buffers.
        }
    };

    // Batch the outfits into groups of size CONCURRENCY to limit parallelism
    for (let i = 0; i < outfitsToProcess.length; i += CONCURRENCY) {
      const batch = outfitsToProcess.slice(i, i + CONCURRENCY).map((of, idx) => processOutfit(of, i + idx));
      // Wait for this batch to finish before starting the next
      const results = await Promise.all(batch);
      enrichedOutfits.push(...results);
    }

    console.log('✅ All outfits processed in parallel!');

    // Post-processing: If Gemini produced rich colorDetails, build a top-level colorSuggestions
    try {
      const allDominant = enrichedOutfits
        .flatMap((o: any) => (o.colorDetails || []).map((c: any) => ({ name: c.name, hex: c.hex })))
        .filter(Boolean);

      const uniqueByHex = Array.from(new Map(allDominant.map((c: any) => [c.hex, c])).values());

      if (uniqueByHex.length > 0) {
        // Replace top-level colorSuggestions with Gemini-derived palette if available
        analysis.colorSuggestions = uniqueByHex.slice(0, 10).map((c: any) => ({
          name: c.name || c.hex,
          hex: c.hex,
          reason: `Extracted from generated image and verified by Gemini analysis.`,
        }));
      }
    } catch (err) {
      console.warn('⚠️ Failed to build top-level colorSuggestions from Gemini data:', err);
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
