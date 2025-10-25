import { NextResponse } from 'next/server';
import tavilySearch from '@/lib/tavily';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, colors, gender, occasion } = body;
    if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

    const links = await tavilySearch(query, colors || [], gender, occasion);
    return NextResponse.json({ links });
  } catch (err: any) {
    console.warn('Tavily API route error', err);
    return NextResponse.json({ error: err?.message || 'unknown' }, { status: 500 });
  }
}
