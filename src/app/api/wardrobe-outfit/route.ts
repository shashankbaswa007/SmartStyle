import { NextRequest, NextResponse } from 'next/server';
import { generateWardrobeOutfits } from '@/lib/wardrobeOutfitGenerator';
import { fetchWeatherForecast } from '@/lib/weather-service';
import { verifyBearerToken, AuthError } from '@/lib/server-auth';
import { checkServerRateLimit } from '@/lib/server-rate-limiter';
import { getClientIdentifier } from '@/lib/rate-limiter';
import { 
  generateWardrobeHash, 
  generateRequestHash, 
  getCachedRecommendation, 
  cacheRecommendation 
} from '@/lib/recommendations-cache';
const MAX_REQUESTS_PER_HOUR = 20;

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserId = await verifyBearerToken(request);

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    const { userId, occasion, date, wardrobeItems } = body;

    // Validate required fields
    if (!userId || !occasion) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and occasion are required' },
        { status: 400 }
      );
    }
    
    // Validate wardrobe items
    if (!wardrobeItems || !Array.isArray(wardrobeItems) || wardrobeItems.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: wardrobeItems array is required' },
        { status: 400 }
      );
    }

    // Ensure user can only access their own wardrobe
    if (userId !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'Forbidden - You can only access your own wardrobe' },
        { status: 403 }
      );
    }

    // Shared, persistent rate limiting for AI-intensive endpoint.
    const clientId = getClientIdentifier(request);
    const rateLimit = await checkServerRateLimit(`${userId}:${clientId}`, {
      scope: 'wardrobe-outfit',
      windowMs: 60 * 60 * 1000,
      maxRequests: MAX_REQUESTS_PER_HOUR,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: rateLimit.message || `You can generate up to ${MAX_REQUESTS_PER_HOUR} outfit suggestions per hour. Please try again later.`,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
          },
        }
      );
    }

    // Fetch weather data if date is provided
    let weatherData = null;
    if (date) {
      try {
        const targetDate = new Date(date);
        weatherData = await fetchWeatherForecast(targetDate);
        
        if (weatherData) {
        }
      } catch (weatherError) {
        // Continue without weather data rather than failing the entire request
      }
    }

    // Generate hashes for caching
    const wardrobeHash = generateWardrobeHash(wardrobeItems);
    const requestHash = generateRequestHash({
      userId,
      occasion,
      wardrobeItemIds: wardrobeItems.map(item => item.id || ''),
    });

    // Check cache first for instant results
    const cachedResult = getCachedRecommendation(requestHash, wardrobeHash);
    if (cachedResult) {
      return NextResponse.json(
        { 
          ...cachedResult,
          weather: weatherData,
          cached: true, // Indicate this is a cached response
        },
        { status: 200 }
      );
    }

    // Generate outfit suggestions (expensive AI call)
    let result;
    try {
      result = await generateWardrobeOutfits(
        wardrobeItems,
        userId, 
        occasion, 
        weatherData || undefined
      );
      
      // Cache the result for future requests
      cacheRecommendation(userId, requestHash, wardrobeHash, result);
    } catch (generationError) {
      
      // Handle specific errors
      if (generationError instanceof Error) {
        if (generationError.message.includes('No wardrobe items')) {
          return NextResponse.json(
            { 
              error: 'Empty wardrobe',
              message: 'You need to add items to your wardrobe before we can generate outfit suggestions.'
            },
            { status: 400 }
          );
        }
        if (generationError.message.includes('Not enough items')) {
          return NextResponse.json(
            { 
              error: 'Insufficient items',
              message: 'You need at least a few items in your wardrobe to create outfit combinations.'
            },
            { status: 400 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Failed to generate outfit suggestions. Please try again.' },
        { status: 500 }
      );
    }

    // Return successful response with weather data
    return NextResponse.json(
      { 
        ...result,
        weather: weatherData,
        cached: false, // Freshly generated
      },
      { status: 200 }
    );

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for retrieving saved outfit combinations
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyBearerToken(request);

    // Get saved outfits (this would use getWardrobeOutfits from wardrobeService)
    // For now, return empty array as placeholder
    return NextResponse.json(
      { 
        savedOutfits: [],
        message: 'Saved outfits feature coming soon'
      },
      { status: 200 }
    );

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
