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
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate request body against schema
    const validation = tavilyRequestSchema.safeParse(body);
    if (!validation.success) {
      console.error('❌ Validation failed:', validation.error.errors);
      return NextResponse.json(
        { 
          error: 'Invalid request parameters',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      );
    }

    const { query, colors, gender, occasion } = validation.data;
    
    console.log('🔍 Tavily API route called with:', { query, colors, gender, occasion });

    try {
      const links = await tavilySearch(query, colors || [], gender, occasion);
      
      console.log('✅ Tavily search completed:', links);
      
      return NextResponse.json({ links });
    } catch (searchError) {
      console.error('❌ Tavily search failed:', searchError);
      
      // Return empty links instead of failing
      return NextResponse.json({ 
        links: { amazon: null, ajio: null, myntra: null },
        warning: 'Shopping links temporarily unavailable'
      });
    }
  } catch (err: any) {
    console.error('❌ Tavily API route error:', err);
    
    // Detailed error logging
    if (err instanceof Error) {
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    }

    return NextResponse.json({ 
      error: err?.message || 'Failed to search for shopping links',
      links: { amazon: null, ajio: null, myntra: null }
    }, { status: 500 });
  }
}
