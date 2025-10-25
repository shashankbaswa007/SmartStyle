import { NextResponse } from 'next/server';
import { analyzeImageAndProvideRecommendations } from '@/ai/flows/analyze-image-and-provide-recommendations';
import { generateOutfitImage } from '@/ai/flows/generate-outfit-image';
import tavilySearch from '@/lib/tavily';
import saveRecommendation from '@/lib/firestoreRecommendations';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { photoDataUri, occasion, genre, gender, weather, skinTone, dressColors, previousRecommendation, userId } = body;

    // Step 1: Analyze via Gemini flow
    const analysis = await analyzeImageAndProvideRecommendations({ photoDataUri, occasion, genre, gender, weather, skinTone, dressColors, previousRecommendation });

    // Step 2: Prepare image prompts for the 3 outfits
    const prompts = analysis.outfitRecommendations.slice(0,3).map(r => r.imagePrompt || `${r.title} ${r.items.join(' ')}`);

    // Step 3: Generate images in parallel
    const imagesResult = await generateOutfitImage({ outfitDescriptions: prompts });

    // Step 4: Fetch e-commerce links in parallel for each outfit (best-effort)
    const linkPromises = analysis.outfitRecommendations.slice(0,3).map(async (outfit, idx) => {
      const query = `${outfit.title} ${outfit.items.join(' ')}`;
      const colors = outfit.colorPalette || [];
      const links = await tavilySearch(query, colors, gender, occasion);
      return links;
    });

    const linkResults = await Promise.all(linkPromises);

    // Attach image urls and shopping links to recommendations
    const enriched = analysis.outfitRecommendations.slice(0,3).map((r, i) => ({
      ...r,
      imageUrl: imagesResult.imageUrls[i] || null,
      shoppingLinks: linkResults[i] || { amazon: null, flipkart: null, myntra: null },
    }));

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
      analysis: { ...analysis, outfitRecommendations: enriched },
    };

    // Step 5: Persist recommendation metadata if userId present
    let recommendationId: string | null = null;
    if (userId) {
      recommendationId = await saveRecommendation(userId, payload);
      console.log(`✅ Recommendation saved with ID: ${recommendationId}`);
    }

    return NextResponse.json({ 
      success: true, 
      payload,
      recommendationId 
    });
  } catch (err: any) {
    console.warn('Recommend route error', err);
    return NextResponse.json({ error: err?.message || 'unknown' }, { status: 500 });
  }
}
