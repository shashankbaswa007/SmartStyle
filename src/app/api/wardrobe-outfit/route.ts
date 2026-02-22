import { NextRequest, NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';
import { generateWardrobeOutfits } from '@/lib/wardrobeOutfitGenerator';
import { fetchWeatherForecast } from '@/lib/weather-service';
import { 
  generateWardrobeHash, 
  generateRequestHash, 
  getCachedRecommendation, 
  cacheRecommendation 
} from '@/lib/recommendations-cache';

// Rate limiting using simple in-memory store (consider Redis for production)
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_HOUR = 20;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimits.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimits.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (userLimit.count >= MAX_REQUESTS_PER_HOUR) {
    return false;
  }

  userLimit.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify authentication
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (authError) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const authenticatedUserId = decodedToken.uid;

    // Parse request body
    const body = await request.json();
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

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `You can generate up to ${MAX_REQUESTS_PER_HOUR} outfit suggestions per hour. Please try again later.`
        },
        { status: 429 }
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
      cacheRecommendation(requestHash, wardrobeHash, result);
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for retrieving saved outfit combinations
export async function GET(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify authentication
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (authError) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
