import { NextResponse } from 'next/server';
import tavilySearch from '@/lib/tavily';

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

    const { query, colors, gender, occasion } = body;
    
    console.log('🔍 Tavily API route called with:', { query, colors, gender, occasion });
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
      console.warn('❌ Missing or invalid query parameter');
      return NextResponse.json({ 
        error: 'Missing or invalid query parameter',
        details: 'A search query is required'
      }, { status: 400 });
    }

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
