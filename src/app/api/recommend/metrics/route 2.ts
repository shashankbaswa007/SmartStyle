import { NextResponse } from 'next/server';
import { getRecommendMetrics } from '@/lib/recommend/async-jobs';

export async function GET() {
  const metrics = await getRecommendMetrics();
  return NextResponse.json({ success: true, metrics });
}
