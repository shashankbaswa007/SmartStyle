import { NextResponse } from 'next/server';
import tavilySearch from '@/lib/tavily';
import { z } from 'zod';
import { getClientIdentifier } from '@/lib/rate-limiter';
import { checkServerRateLimit } from '@/lib/server-rate-limiter';
import { verifyBearerToken, AuthError } from '@/lib/server-auth';

// Input validation schema
const tavilyRequestSchema = z.object({
  query: z.string().min(1).max(200),
  colors: z.array(z.string()).max(10).optional(),
  gender: z.enum(['male', 'female', 'unisex']).optional(),
  occasion: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  try {
    const userId = await verifyBearerToken(req);

    // Rate limit paid endpoint via Firestore (shared across instances).
    const clientId = getClientIdentifier(req);
    const rateLimit = await checkServerRateLimit(`${userId}:${clientId}`, {
      scope: 'tavily',
      windowMs: 60_000,
      maxRequests: 30,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', links: { amazon: null, tatacliq: null, myntra: null } },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
          },
        }
      );
    }

    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate request body against schema
    const validation = tavilyRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request parameters',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      );
    }

    const { query, colors, gender, occasion } = validation.data;

    try {
      const links = await tavilySearch(query, colors || [], gender, occasion);
      return NextResponse.json({ links });
    } catch {
      // Return empty links instead of failing
      return NextResponse.json({ 
        links: { amazon: null, tatacliq: null, myntra: null },
        warning: 'Shopping links temporarily unavailable'
      });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, links: { amazon: null, tatacliq: null, myntra: null } },
        { status: error.status }
      );
    }

    return NextResponse.json({ 
      error: 'Failed to search for shopping links',
      links: { amazon: null, tatacliq: null, myntra: null }
    }, { status: 500 });
  }
}
