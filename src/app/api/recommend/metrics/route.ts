import { NextResponse } from 'next/server';
import { getRecommendMetrics } from '@/lib/recommend/async-jobs';
import { verifyBearerToken, AuthError } from '@/lib/server-auth';

function hasValidSecret(request: Request): boolean {
  const configuredSecret = process.env.RECOMMEND_METRICS_READ_SECRET;
  const headerSecret = request.headers.get('x-metrics-secret') || '';

  if (configuredSecret) {
    return headerSecret === configuredSecret;
  }

  return false;
}

export async function GET(request: Request) {
  const configuredSecret = process.env.RECOMMEND_METRICS_READ_SECRET;

  if (configuredSecret) {
    if (!hasValidSecret(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const metrics = await getRecommendMetrics();
    return NextResponse.json({ success: true, metrics });
  }

  if (process.env.NODE_ENV !== 'production') {
    const metrics = await getRecommendMetrics();
    return NextResponse.json({ success: true, metrics });
  }

  try {
    await verifyBearerToken(request);
    const metrics = await getRecommendMetrics();
    return NextResponse.json({ success: true, metrics });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'UNAUTHORIZED' },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
}
