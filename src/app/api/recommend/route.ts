import { NextResponse } from 'next/server';
import { recommendRequestSchema, validateRequest, formatValidationError } from '@/lib/validation';
import { quickValidateImageDataUri } from '@/lib/server-image-validation';
import { enforceRecommendAuth, enforceRecommendRateLimit, AuthError } from '@/lib/recommend/request-guard';
import { enqueueRecommendJob, markRecommendJobRateLimited, startRecommendJob } from '@/lib/recommend/async-jobs';

function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      message,
      code,
      ...extra,
    },
    { status }
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return buildErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
  }

  const validation = validateRequest(recommendRequestSchema, body);
  if (!validation.success) {
    return NextResponse.json(formatValidationError(validation.error), { status: 400 });
  }

  const input = validation.data;

  const imageValidation = quickValidateImageDataUri(input.photoDataUri);
  if (!imageValidation.isValid) {
    return buildErrorResponse(400, 'INVALID_IMAGE', imageValidation.error || 'Invalid image payload');
  }

  let userId = input.userId || 'anonymous';
  if (userId !== 'anonymous') {
    try {
      userId = (await enforceRecommendAuth(req, userId)) || 'anonymous';
    } catch (error) {
      if (error instanceof AuthError) {
        return buildErrorResponse(error.status, 'AUTH_ERROR', error.message);
      }
      return buildErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized - invalid authentication token');
    }
  }

  const normalizedInput = {
    ...input,
    dressColors: Array.isArray(input.dressColors)
      ? input.dressColors
      : typeof input.dressColors === 'string'
        ? input.dressColors.split(',').map((c: string) => c.trim()).filter(Boolean)
        : undefined,
    userId,
  };

  const queued = await enqueueRecommendJob(normalizedInput, userId, { autoStart: false });

  if (queued.deduped) {
    return NextResponse.json(
      {
        success: true,
        status: 'queued',
        jobId: queued.jobId,
        deduped: true,
        existingStatus: queued.status,
        message: 'Similar request already in progress or cached; attached to existing job.',
      },
      { status: 202 }
    );
  }

  try {
    const limitResult = await enforceRecommendRateLimit(req, userId === 'anonymous' ? undefined : userId);
    if (!limitResult.rateLimit.allowed) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((limitResult.rateLimit.resetAt.getTime() - Date.now()) / 1000)
      );

      await markRecommendJobRateLimited(
        queued.jobId,
        limitResult.rateLimit.message || 'Rate limit exceeded'
      );

      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          status: 'rate_limited',
          error: limitResult.rateLimit.message || 'Rate limit exceeded',
          remaining: 0,
          resetAt: limitResult.rateLimit.resetAt,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': limitResult.rateLimit.resetAt.toISOString(),
            'Retry-After': String(retryAfterSeconds),
          },
        }
      );
    }

  } catch {
    await markRecommendJobRateLimited(
      queued.jobId,
      'Unable to verify current usage. Please retry shortly.'
    );
    return buildErrorResponse(429, 'RATE_LIMIT_UNAVAILABLE', 'Unable to verify current usage. Please retry shortly.');
  }

  await startRecommendJob(queued.jobId);

  return NextResponse.json(
    {
      success: true,
      status: 'queued',
      jobId: queued.jobId,
      deduped: queued.deduped,
      message: queued.deduped
        ? 'Similar request already in progress or cached; attached to existing job.'
        : 'Recommendation job queued successfully.',
    },
    { status: 202 }
  );
}
