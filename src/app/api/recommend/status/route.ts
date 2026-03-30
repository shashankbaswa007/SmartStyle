import { NextResponse } from 'next/server';
import { enforceRecommendAuth, AuthError } from '@/lib/recommend/request-guard';
import { getRecommendJobStatus } from '@/lib/recommend/async-jobs';
import { verifyBearerToken } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      success: false,
      code,
      error: message,
      message,
    },
    { status, headers: NO_STORE_HEADERS }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId')?.trim();
  const requestedUserId = url.searchParams.get('userId')?.trim() || 'anonymous';
  let authenticatedUserId: string | null = null;

  if (!jobId) {
    return errorResponse(400, 'MISSING_JOB_ID', 'Query parameter jobId is required');
  }

  if (requestedUserId !== 'anonymous') {
    try {
      await enforceRecommendAuth(req, requestedUserId);
      authenticatedUserId = await verifyBearerToken(req);
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

  const ownerUserId = job.input.userId || 'anonymous';
  if (ownerUserId !== 'anonymous') {
    if (!authenticatedUserId) {
      try {
        authenticatedUserId = await verifyBearerToken(req);
      } catch {
        return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized - invalid authentication token');
      }
    }

    if (authenticatedUserId !== ownerUserId) {
      return errorResponse(403, 'FORBIDDEN', 'Forbidden - recommendation job does not belong to authenticated user');
    }
  } else if (requestedUserId !== 'anonymous') {
    return errorResponse(403, 'FORBIDDEN', 'Forbidden - user mismatch for anonymous recommendation job');
  }

  if (job.status === 'queued' || job.status === 'processing') {
    return NextResponse.json(
      {
        success: true,
        status: job.status,
        jobId: job.jobId,
        progress: job.progress,
        partialPayload: job.partialPayload ?? null,
        updatedAt: job.updatedAt,
      },
      { headers: NO_STORE_HEADERS }
    );
  }

  const result = job.result as
    | {
        payload?: unknown;
        recommendationId?: string | null;
        cached?: boolean;
        cacheSource?: string;
      }
    | undefined;

  return NextResponse.json(
    {
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
    },
    { headers: NO_STORE_HEADERS }
  );
}
