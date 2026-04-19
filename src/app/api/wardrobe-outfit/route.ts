import { NextRequest, NextResponse } from 'next/server';
import { generateWardrobeOutfits } from '@/lib/wardrobeOutfitGenerator';
import { fetchWeatherForecast } from '@/lib/weather-service';
import { verifyBearerToken, AuthError } from '@/lib/server-auth';
import { reserveServerRateLimit, confirmServerRateLimit, releaseServerRateLimit } from '@/lib/server-rate-limiter';
import { DAILY_WINDOW_MS, getTimezoneOffsetMinutesFromRequest, RATE_LIMIT_SCOPES, USAGE_LIMITS } from '@/lib/usage-limits';
import { 
  generateWardrobeHash, 
  generateRequestHash, 
  getCachedRecommendation, 
  cacheRecommendation 
} from '@/lib/recommendations-cache';
import { validateRequestOrigin } from '@/lib/csrf-protection';
import { buildUsageIdempotencyKey } from '@/lib/usage-idempotency';
const MAX_REQUESTS_PER_DAY = USAGE_LIMITS.wardrobeOutfit;

function isBackendUnavailableMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('temporarily unavailable') ||
    normalized.includes('backend unavailable') ||
    normalized.includes('service unavailable')
  );
}

export async function POST(request: NextRequest) {
  let reservation: { subject: string; reservationId: string; timezoneOffsetMinutes: number } | null = null;

  try {
    if (!validateRequestOrigin(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const authenticatedUserId = await verifyBearerToken(request);
    const timezoneOffsetMinutes = getTimezoneOffsetMinutesFromRequest(request);

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

    const reservationId = buildUsageIdempotencyKey({
      scope: RATE_LIMIT_SCOPES.wardrobeOutfit,
      userId,
      payload: {
        occasion,
        date,
        itemIds: wardrobeItems.map((item: { id?: string }) => item.id || '').sort(),
      },
      request,
    });

    // Reserve a slot, then confirm only after successful generation.
    const rateLimit = await reserveServerRateLimit(userId, {
      scope: RATE_LIMIT_SCOPES.wardrobeOutfit,
      windowMs: DAILY_WINDOW_MS,
      maxRequests: MAX_REQUESTS_PER_DAY,
      timezoneOffsetMinutes,
    }, reservationId, { reservationTtlMs: 15 * 60_000 });
    const rateLimitMessage = typeof rateLimit.message === 'string' ? rateLimit.message : '';
    const rateLimitBackendUnavailable = !rateLimit.allowed && isBackendUnavailableMessage(rateLimitMessage);

    reservation = { subject: userId, reservationId, timezoneOffsetMinutes };

    if (!rateLimit.allowed && !rateLimitBackendUnavailable) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: rateLimit.message || `You can generate up to ${MAX_REQUESTS_PER_DAY} outfit suggestions per day. Please try again later.`,
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

    if (rateLimitBackendUnavailable) {
      console.warn('[wardrobe-outfit] Rate limit backend unavailable; continuing in degraded mode', {
        userId,
        reservationId,
      });
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
      if (reservation) {
        await releaseServerRateLimit(reservation.subject, {
          scope: RATE_LIMIT_SCOPES.wardrobeOutfit,
          windowMs: DAILY_WINDOW_MS,
          maxRequests: MAX_REQUESTS_PER_DAY,
          timezoneOffsetMinutes: reservation.timezoneOffsetMinutes,
        }, reservation.reservationId);
      }
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
      console.error('[wardrobe-outfit] Generation failed', {
        userId,
        occasion,
        itemCount: Array.isArray(wardrobeItems) ? wardrobeItems.length : 0,
        error: generationError instanceof Error ? generationError.message : generationError,
      });
      
      // Handle specific errors
      if (generationError instanceof Error) {
        if (generationError.message.includes('No wardrobe items')) {
          if (reservation) {
            await releaseServerRateLimit(reservation.subject, {
              scope: RATE_LIMIT_SCOPES.wardrobeOutfit,
              windowMs: DAILY_WINDOW_MS,
              maxRequests: MAX_REQUESTS_PER_DAY,
              timezoneOffsetMinutes: reservation.timezoneOffsetMinutes,
            }, reservation.reservationId);
          }
          return NextResponse.json(
            { 
              error: 'Empty wardrobe',
              code: 'WARDROBE_EMPTY',
              message: 'You need to add items to your wardrobe before we can generate outfit suggestions.'
            },
            { status: 400 }
          );
        }
        if (generationError.message.includes('Not enough items')) {
          if (reservation) {
            await releaseServerRateLimit(reservation.subject, {
              scope: RATE_LIMIT_SCOPES.wardrobeOutfit,
              windowMs: DAILY_WINDOW_MS,
              maxRequests: MAX_REQUESTS_PER_DAY,
              timezoneOffsetMinutes: reservation.timezoneOffsetMinutes,
            }, reservation.reservationId);
          }
          return NextResponse.json(
            { 
              error: 'Insufficient items',
              code: 'WARDROBE_TOO_SMALL',
              message: 'You need at least a few items in your wardrobe to create outfit combinations.'
            },
            { status: 400 }
          );
        }
      }

      if (reservation) {
        await releaseServerRateLimit(reservation.subject, {
          scope: RATE_LIMIT_SCOPES.wardrobeOutfit,
          windowMs: DAILY_WINDOW_MS,
          maxRequests: MAX_REQUESTS_PER_DAY,
          timezoneOffsetMinutes: reservation.timezoneOffsetMinutes,
        }, reservation.reservationId);
      }

      return NextResponse.json(
        {
          error: 'Failed to generate outfit suggestions. Please try again.',
          code: 'OUTFIT_GENERATION_FAILED',
          message: 'The recommendation service is temporarily unavailable. Please retry in a moment.',
        },
        { status: 500 }
      );
    }

    const confirmed = rateLimitBackendUnavailable
      ? {
          remaining: MAX_REQUESTS_PER_DAY,
          limit: MAX_REQUESTS_PER_DAY,
          resetAt: new Date(Date.now() + DAILY_WINDOW_MS),
        }
      : await confirmServerRateLimit(userId, {
          scope: RATE_LIMIT_SCOPES.wardrobeOutfit,
          windowMs: DAILY_WINDOW_MS,
          maxRequests: MAX_REQUESTS_PER_DAY,
          timezoneOffsetMinutes,
        }, reservationId);

    // Return successful response with weather data
    return NextResponse.json(
      { 
        ...result,
        weather: weatherData,
        cached: false, // Freshly generated
        degraded: rateLimitBackendUnavailable,
        backendAvailable: !rateLimitBackendUnavailable,
        usage: {
          remaining: confirmed.remaining,
          limit: confirmed.limit,
          resetAt: confirmed.resetAt.toISOString(),
        },
      },
      {
        status: 200,
        headers: rateLimitBackendUnavailable
          ? undefined
          : {
              'X-RateLimit-Remaining': String(confirmed.remaining),
              'X-RateLimit-Reset': confirmed.resetAt.toISOString(),
            },
      }
    );

  } catch (error) {
    if (reservation) {
      await releaseServerRateLimit(reservation.subject, {
        scope: RATE_LIMIT_SCOPES.wardrobeOutfit,
        windowMs: DAILY_WINDOW_MS,
        maxRequests: MAX_REQUESTS_PER_DAY,
        timezoneOffsetMinutes: reservation.timezoneOffsetMinutes,
      }, reservation.reservationId);
    }

    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
        },
        { status: error.status }
      );
    }

    console.error('[wardrobe-outfit] Unhandled error', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      },
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
