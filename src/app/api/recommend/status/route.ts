import { NextResponse } from 'next/server';
import { enforceRecommendAuth, AuthError } from '@/lib/recommend/request-guard';
import { getRecommendJobStatus } from '@/lib/recommend/async-jobs';

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      success: false,
      code,
      error: message,
      message,
    },
    { status }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId')?.trim();
  const userId = url.searchParams.get('userId')?.trim() || 'anonymous';

  if (!jobId) {
    return errorResponse(400, 'MISSING_JOB_ID', 'Query parameter jobId is required');
  }

  if (userId !== 'anonymous') {
    try {
      await enforceRecommendAuth(req, userId);
    } catch (error) {
      if (error instanceof AuthError) {
        return errorResponse(error.status, 'AUTH_ERROR', error.message);
      }
      return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized - invalid authentication token');
    }
  }

  const job = await getRecommendJobStatus(jobId);
  if (!job) {
    return errorResponse(404, 'JOB_NOT_FOUND', 'No recommendation job found for the provided id');
  }

  if (job.status === 'queued' || job.status === 'processing') {
    return NextResponse.json({
      success: true,
      status: job.status,
      jobId: job.jobId,
      progress: job.progress,
      partialPayload: job.partialPayload ?? null,
      updatedAt: job.updatedAt,
    });
  }

  const result = job.result as
    | {
        payload?: unknown;
        recommendationId?: string | null;
        cached?: boolean;
        cacheSource?: string;
      }
    | undefined;

  return NextResponse.json({
    success: true,
    status: job.status,
    jobId: job.jobId,
    progress: job.progress,
    partialPayload: job.partialPayload ?? null,
    payload: result?.payload ?? null,
    recommendationId: result?.recommendationId ?? null,
    cached: result?.cached ?? false,
    cacheSource: result?.cacheSource ?? 'job',
    fallbackSource: job.fallbackSource,
    error: job.error,
    completedAt: job.completedAt,
  });
}
