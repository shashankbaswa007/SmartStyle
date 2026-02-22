import { NextResponse } from 'next/server';
import tavilySearch from '@/lib/tavily';
import { z } from 'zod';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter';

// Input validation schema
const tavilyRequestSchema = z.object({
  query: z.string().min(1).max(200),
  colors: z.array(z.string()).max(10).optional(),
  gender: z.enum(['male', 'female', 'unisex']).optional(),
  occasion: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  try {
    // Verify authentication — Tavily has API costs, require auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', links: { amazon: null, ajio: null, myntra: null } },
        { status: 401 }
      );
    }
    try {
      const admin = (await import('@/lib/firebase-admin')).default;
      await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token', links: { amazon: null, ajio: null, myntra: null } },
        { status: 401 }
      );
    }

    // Rate limit: 30 requests per minute per IP (Tavily has API costs)
    const clientId = getClientIdentifier(req);
    const rateLimit = checkRateLimit(clientId, { windowMs: 60_000, maxRequests: 30 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', links: { amazon: null, ajio: null, myntra: null } },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
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
        links: { amazon: null, ajio: null, myntra: null },
        warning: 'Shopping links temporarily unavailable'
      });
    }
  } catch {
    return NextResponse.json({ 
      error: 'Failed to search for shopping links',
      links: { amazon: null, ajio: null, myntra: null }
    }, { status: 500 });
  }
}
