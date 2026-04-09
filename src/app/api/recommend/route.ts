import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  recommendRequestSchema,
  validateRequest,
  formatValidationError,
  sanitizePromptText,
  MAX_IMAGE_DATA_URI_CHARS,
} from '@/lib/validation';
import { quickValidateImageDataUri } from '@/lib/server-image-validation';
import { enforceRecommendAuth, enforceRecommendRateLimit, AuthError } from '@/lib/recommend/request-guard';
import {
  enqueueRecommendJob,
  markRecommendJobRateLimited,
  setRecommendJobUsageReservation,
  startRecommendJob,
  awaitRecommendJobTerminalState,
  RECOMMEND_JOB_TIMEOUT_MS,
} from '@/lib/recommend/async-jobs';
import { buildUsageIdempotencyKey } from '@/lib/usage-idempotency';
import { getTimezoneOffsetMinutesFromRequest, RATE_LIMIT_SCOPES } from '@/lib/usage-limits';

function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      message,
      code,
      requestId,
      ...extra,
    },
    {
      status,
      headers: {
        'X-Request-Id': requestId,
      },
    }
  );
}

export async function POST(req: Request) {
  const TERMINAL_WAIT_MS = Math.min(55_000, RECOMMEND_JOB_TIMEOUT_MS - 3_000);
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return buildErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body', requestId);
  }

  const validation = validateRequest(recommendRequestSchema, body);
  if (!validation.success) {
    return NextResponse.json(
      {
        ...formatValidationError(validation.error),
        requestId,
      },
      {
        status: 400,
        headers: {
          'X-Request-Id': requestId,
        },
      }
    );
  }

  const input = validation.data;

  const imageValidation = quickValidateImageDataUri(input.photoDataUri);
  if (!imageValidation.isValid) {
    return buildErrorResponse(400, 'INVALID_IMAGE', imageValidation.error || 'Invalid image payload', requestId);
  }

  if (input.photoDataUri.length > MAX_IMAGE_DATA_URI_CHARS) {
    return buildErrorResponse(413, 'IMAGE_TOO_LARGE', 'Image payload too large. Please upload a smaller image.', requestId);
  }

  let userId = input.userId || 'anonymous';
  if (userId !== 'anonymous') {
    try {
      userId = (await enforceRecommendAuth(req, userId)) || 'anonymous';
    } catch (error) {
      if (error instanceof AuthError) {
        return buildErrorResponse(error.status, 'AUTH_ERROR', error.message, requestId);
      }
      return buildErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized - invalid authentication token', requestId);
    }
  }

  const normalizedInput = {
    ...input,
    occasion: sanitizePromptText(input.occasion),
    genre: sanitizePromptText(input.genre),
    dressColors: Array.isArray(input.dressColors)
      ? input.dressColors
      : typeof input.dressColors === 'string'
        ? input.dressColors.split(',').map((c: string) => c.trim()).filter(Boolean)
        : undefined,
    userId,
  };

  const queued = await enqueueRecommendJob(normalizedInput, userId, { autoStart: false, requestId });

  const usageSubject = userId !== 'anonymous'
    ? userId
    : `anon:${req.headers.get('x-forwarded-for') || 'unknown'}`;
  const usageReservationId = buildUsageIdempotencyKey({
    scope: RATE_LIMIT_SCOPES.recommend,
    userId: usageSubject,
    payload: {
      requestId,
      dedupeKeySeed: queued.jobId,
      occasion: normalizedInput.occasion,
      genre: normalizedInput.genre,
      userId: normalizedInput.userId,
    },
    request: req,
  });
  const timezoneOffsetMinutes = getTimezoneOffsetMinutesFromRequest(req);

  if (queued.deduped) {
    if (queued.status === 'completed' || queued.status === 'failed') {
      const terminalJob = await awaitRecommendJobTerminalState(queued.jobId, {
        timeoutMs: 1200,
        pollIntervalMs: 200,
      });

      if (terminalJob && (terminalJob.status === 'completed' || terminalJob.status === 'failed')) {
        const result = terminalJob.result as
          | {
              payload?: unknown;
              recommendationId?: string | null;
              cached?: boolean;
              cacheSource?: string;
              code?: string;
              success?: boolean;
              error?: string;
              message?: string;
            }
          | undefined;

        return NextResponse.json(
          {
            success: true,
            requestId,
            status: terminalJob.status,
            jobId: terminalJob.jobId,
            progress: terminalJob.progress,
            partialPayload: terminalJob.partialPayload ?? null,
            payload: result?.payload ?? null,
            recommendationId: result?.recommendationId ?? null,
            cached: result?.cached ?? true,
            cacheSource: result?.cacheSource ?? 'job',
            fallbackSource: terminalJob.fallbackSource,
            error: result?.error ?? terminalJob.error,
            code: result?.code,
            completedAt: terminalJob.completedAt,
            deduped: true,
          },
          { status: 200, headers: { 'X-Request-Id': requestId } }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        requestId,
        status: 'queued',
        jobId: queued.jobId,
        deduped: true,
        existingStatus: queued.status,
        message: 'Similar request already in progress or cached; attached to existing job.',
      },
      { status: 202, headers: { 'X-Request-Id': requestId } }
    );
  }

  try {
    const limitResult = await enforceRecommendRateLimit(
      req,
      userId === 'anonymous' ? undefined : userId,
      usageReservationId
    );
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
          requestId,
          code: 'RATE_LIMIT_EXCEEDED',
          status: 'rate_limited',
          error: limitResult.rateLimit.message || 'Rate limit exceeded',
          remaining: 0,
          resetAt: limitResult.rateLimit.resetAt,
        },
        {
          status: 429,
          headers: {
            'X-Request-Id': requestId,
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': limitResult.rateLimit.resetAt.toISOString(),
            'Retry-After': String(retryAfterSeconds),
          },
        }
      );
    }

    await setRecommendJobUsageReservation(queued.jobId, {
      subject: usageSubject,
      reservationId: usageReservationId,
      timezoneOffsetMinutes,
    });

  } catch {
    await markRecommendJobRateLimited(
      queued.jobId,
      'Unable to verify current usage. Please retry shortly.'
    );
    return buildErrorResponse(429, 'RATE_LIMIT_UNAVAILABLE', 'Unable to verify current usage. Please retry shortly.', requestId);
  }

  await startRecommendJob(queued.jobId);

  const terminalJob = await awaitRecommendJobTerminalState(queued.jobId, {
    timeoutMs: TERMINAL_WAIT_MS,
    pollIntervalMs: 550,
  });

  if (terminalJob && (terminalJob.status === 'completed' || terminalJob.status === 'failed')) {
    const result = terminalJob.result as
      | {
          payload?: unknown;
          recommendationId?: string | null;
          cached?: boolean;
          cacheSource?: string;
          code?: string;
          success?: boolean;
          error?: string;
          message?: string;
        }
      | undefined;

    return NextResponse.json(
      {
        success: true,
        requestId,
        status: terminalJob.status,
        jobId: terminalJob.jobId,
        progress: terminalJob.progress,
        partialPayload: terminalJob.partialPayload ?? null,
        payload: result?.payload ?? null,
        recommendationId: result?.recommendationId ?? null,
        cached: result?.cached ?? false,
        cacheSource: result?.cacheSource ?? 'job',
        fallbackSource: terminalJob.fallbackSource,
        error: result?.error ?? terminalJob.error,
        code: result?.code,
        completedAt: terminalJob.completedAt,
      },
      { status: 200, headers: { 'X-Request-Id': requestId } }
    );
  }

  return NextResponse.json(
    {
      success: true,
      requestId,
      status: 'queued',
      jobId: queued.jobId,
      deduped: queued.deduped,
      message: queued.deduped
        ? 'Similar request already in progress or cached; attached to existing job.'
        : 'Recommendation job queued successfully.',
    },
    { status: 202, headers: { 'X-Request-Id': requestId } }
  );
}
