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
import { validateRequestOrigin } from '@/lib/csrf-protection';
import { logger } from '@/lib/logger';
import { incrementProductionCounter } from '@/lib/production-telemetry';

export const runtime = 'nodejs';
export const maxDuration = 15;
const RECOMMEND_ENDPOINT = '/api/recommend';
const RECOMMEND_SLOW_REQUEST_MS = 2200;

type ObservabilityErrorCategory = 'ENV_MISCONFIGURED' | 'BACKEND_UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN_ERROR';

function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  errorCategory: ObservabilityErrorCategory,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      message,
      code,
      requestId,
      errorCategory,
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

function getRecommendMissingCriticalEnv(): string[] {
  const missing: string[] = [];

  if (!process.env.GROQ_API_KEY && !process.env.GOOGLE_GENAI_API_KEY && !process.env.GOOGLE_GENAI_API_KEY_BACKUP) {
    missing.push('GROQ_API_KEY or GOOGLE_GENAI_API_KEY or GOOGLE_GENAI_API_KEY_BACKUP');
  }

  return missing;
}

function mapUnhandledRecommendError(error: unknown): {
  status: number;
  code: string;
  message: string;
  errorCategory: ObservabilityErrorCategory;
} {
  if (error instanceof AuthError) {
    return {
      status: error.status,
      code: error.status === 403 ? 'AUTH_ERROR' : 'UNAUTHORIZED',
      message: error.message,
      errorCategory: 'UNKNOWN_ERROR',
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('timeout') || normalized.includes('timed out') || normalized.includes('abort')) {
    return {
      status: 503,
      code: 'RECOMMEND_BACKEND_UNAVAILABLE',
      message: 'Recommendation backend timed out. Please retry shortly.',
      errorCategory: 'TIMEOUT',
    };
  }

  if (
    normalized.includes('temporarily unavailable') ||
    normalized.includes('service unavailable') ||
    normalized.includes('backend unavailable')
  ) {
    return {
      status: 503,
      code: 'RECOMMEND_BACKEND_UNAVAILABLE',
      message: 'Recommendation backend is temporarily unavailable. Please retry shortly.',
      errorCategory: 'BACKEND_UNAVAILABLE',
    };
  }

  return {
    status: 500,
    code: 'RECOMMEND_REQUEST_FAILED',
    message: 'Unable to process recommendation request right now.',
    errorCategory: 'UNKNOWN_ERROR',
  };
}

function isBackendUnavailableMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('temporarily unavailable') ||
    normalized.includes('backend unavailable') ||
    normalized.includes('service unavailable')
  );
}

function toLogSafeError(error: unknown): { name?: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: String(error),
  };
}

export async function POST(req: Request) {
  const TERMINAL_WAIT_MS = Math.max(1_200, Math.min(6_500, RECOMMEND_JOB_TIMEOUT_MS - 3_000));
  const requestStartedAt = Date.now();
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const requestLogger =
    typeof logger.withContext === 'function'
      ? logger.withContext({
          endpoint: RECOMMEND_ENDPOINT,
          requestId,
        })
      : logger;
  let usageRateLimitDegraded = false;
  let queuedJobId: string | null = null;

  const logLifecycle = (
    status: 'start' | 'success' | 'degraded' | 'error',
    details: Record<string, unknown> = {}
  ) => {
    const durationMs = Date.now() - requestStartedAt;
    const isSlow = durationMs >= RECOMMEND_SLOW_REQUEST_MS;
    const event = {
      requestId,
      endpoint: RECOMMEND_ENDPOINT,
      status,
      durationMs,
      isSlow,
      observedAt: new Date().toISOString(),
      errorCode: null,
      errorCategory: null,
      ...(status === 'degraded' ? { degraded: true, backendAvailable: false } : {}),
      ...details,
    };

    if (status === 'error') {
      requestLogger.error('recommend.request_lifecycle', event);
    } else if (status === 'degraded') {
      requestLogger.warn('recommend.request_lifecycle', event);
    } else {
      requestLogger.info('recommend.request_lifecycle', event);
    }

    if (status !== 'start') {
      if (isSlow) {
        requestLogger.warn('recommend.slow_request', {
          requestId,
          endpoint: RECOMMEND_ENDPOINT,
          status,
          durationMs,
          errorCode: event.errorCode,
          errorCategory: event.errorCategory,
        });
      }

      if (isSlow) {
        incrementProductionCounter('recommend.slow_total', 1, {
          endpoint: RECOMMEND_ENDPOINT,
          status,
        });
      }

      incrementProductionCounter('recommend.response_time_ms', durationMs, {
        endpoint: RECOMMEND_ENDPOINT,
        status,
      });
    }
  };

  try {
    logLifecycle('start');

    requestLogger.info('Recommend request received', {
      hasAuthHeader: Boolean(req.headers.get('authorization')),
      contentType: req.headers.get('content-type') || 'unknown',
    });

    if (process.env.NODE_ENV === 'production') {
      const missingCritical = getRecommendMissingCriticalEnv();
      if (missingCritical.length > 0) {
        logLifecycle('degraded', {
          errorCode: 'RECOMMEND_BACKEND_MISCONFIGURED',
          errorCategory: 'ENV_MISCONFIGURED',
          httpStatus: 200,
          backendAvailable: false,
          degraded: true,
          missingCritical,
        });

        return NextResponse.json(
          {
            success: true,
            requestId,
            status: 'failed',
            payload: null,
            fallbackSource: 'simplified',
            degraded: true,
            backendAvailable: false,
            code: 'RECOMMEND_BACKEND_MISCONFIGURED',
            errorCategory: 'ENV_MISCONFIGURED',
            error: 'Recommendation service is not fully configured in this deployment. Serving fallback response.',
            missingCritical,
          },
          {
            status: 200,
            headers: {
              'X-Request-Id': requestId,
            },
          }
        );
      }
    }

    if (!validateRequestOrigin(req)) {
      requestLogger.warn('Recommend request blocked by origin validation');
      logLifecycle('error', {
        errorCode: 'INVALID_ORIGIN',
        errorCategory: 'UNKNOWN_ERROR',
        httpStatus: 403,
      });
      return buildErrorResponse(403, 'INVALID_ORIGIN', 'Invalid request origin', requestId, 'UNKNOWN_ERROR');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      requestLogger.warn('Recommend request contains invalid JSON body');
      logLifecycle('error', {
        errorCode: 'INVALID_JSON',
        errorCategory: 'UNKNOWN_ERROR',
        httpStatus: 400,
      });
      return buildErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body', requestId, 'UNKNOWN_ERROR');
    }

    const validation = validateRequest(recommendRequestSchema, body);
    if (!validation.success) {
      requestLogger.warn('Recommend request validation failed');
      logLifecycle('error', {
        errorCode: 'INVALID_REQUEST',
        errorCategory: 'UNKNOWN_ERROR',
        httpStatus: 400,
      });
      return NextResponse.json(
        {
          ...formatValidationError(validation.error),
          requestId,
          errorCategory: 'UNKNOWN_ERROR',
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
      requestLogger.warn('Recommend request rejected due to invalid image payload');
      logLifecycle('error', {
        errorCode: 'INVALID_IMAGE',
        errorCategory: 'UNKNOWN_ERROR',
        httpStatus: 400,
      });
      return buildErrorResponse(
        400,
        'INVALID_IMAGE',
        imageValidation.error || 'Invalid image payload',
        requestId,
        'UNKNOWN_ERROR'
      );
    }

    if (input.photoDataUri.length > MAX_IMAGE_DATA_URI_CHARS) {
      requestLogger.warn('Recommend request rejected because image payload is too large');
      logLifecycle('error', {
        errorCode: 'IMAGE_TOO_LARGE',
        errorCategory: 'UNKNOWN_ERROR',
        httpStatus: 413,
      });
      return buildErrorResponse(
        413,
        'IMAGE_TOO_LARGE',
        'Image payload too large. Please upload a smaller image.',
        requestId,
        'UNKNOWN_ERROR'
      );
    }

    let userId = input.userId || 'anonymous';
    if (userId !== 'anonymous') {
      try {
        userId = (await enforceRecommendAuth(req, userId)) || 'anonymous';
      } catch (error) {
        requestLogger.warn('Recommend auth verification failed');

        if (error instanceof AuthError) {
          logLifecycle('error', {
            errorCode: 'AUTH_ERROR',
            errorCategory: 'UNKNOWN_ERROR',
            httpStatus: error.status,
          });
          return buildErrorResponse(error.status, 'AUTH_ERROR', error.message, requestId, 'UNKNOWN_ERROR');
        }

        logLifecycle('error', {
          errorCode: 'UNAUTHORIZED',
          errorCategory: 'UNKNOWN_ERROR',
          httpStatus: 401,
        });
        return buildErrorResponse(
          401,
          'UNAUTHORIZED',
          'Unauthorized - invalid authentication token',
          requestId,
          'UNKNOWN_ERROR'
        );
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
    queuedJobId = queued.jobId;

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

          requestLogger.info('Recommend request attached to completed deduped job', {
            jobId: terminalJob.jobId,
            status: terminalJob.status,
          });

          const degradedResponse = terminalJob.status === 'failed';
          const errorCategory: ObservabilityErrorCategory = degradedResponse ? 'BACKEND_UNAVAILABLE' : 'UNKNOWN_ERROR';
          logLifecycle(degradedResponse ? 'degraded' : 'success', {
            errorCode: degradedResponse ? String(result?.code || terminalJob.error || 'RECOMMEND_JOB_FAILED') : null,
            errorCategory: degradedResponse ? errorCategory : null,
            httpStatus: 200,
            terminalStatus: terminalJob.status,
            deduped: true,
          });

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
              errorCategory: degradedResponse ? errorCategory : undefined,
              degraded: degradedResponse,
              backendAvailable: !degradedResponse,
              completedAt: terminalJob.completedAt,
              deduped: true,
            },
            { status: 200, headers: { 'X-Request-Id': requestId } }
          );
        }
      }

      requestLogger.info('Recommend request attached to queued deduped job', {
        jobId: queued.jobId,
        existingStatus: queued.status,
      });

      logLifecycle('success', {
        errorCode: null,
        httpStatus: 202,
        terminalStatus: queued.status,
        deduped: true,
      });

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
        const rateLimitMessage = String(limitResult.rateLimit.message || '');
        const isRateLimitBackendUnavailable = isBackendUnavailableMessage(rateLimitMessage);

        if (isRateLimitBackendUnavailable) {
          usageRateLimitDegraded = true;
          requestLogger.warn('Recommend usage backend unavailable; continuing in degraded mode', {
            jobId: queued.jobId,
          });
        } else {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((limitResult.rateLimit.resetAt.getTime() - Date.now()) / 1000)
          );

          requestLogger.warn('Recommend request rejected by usage rate limits', {
            jobId: queued.jobId,
            resetAt: limitResult.rateLimit.resetAt.toISOString(),
          });

          logLifecycle('error', {
            errorCode: 'RATE_LIMIT_EXCEEDED',
            errorCategory: 'UNKNOWN_ERROR',
            httpStatus: 429,
          });

          await markRecommendJobRateLimited(
            queued.jobId,
            limitResult.rateLimit.message || 'Rate limit exceeded'
          );

          return NextResponse.json(
            {
              success: false,
              requestId,
              code: 'RATE_LIMIT_EXCEEDED',
              errorCategory: 'UNKNOWN_ERROR',
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
      }

      if (!usageRateLimitDegraded) {
        await setRecommendJobUsageReservation(queued.jobId, {
          subject: usageSubject,
          reservationId: usageReservationId,
          timezoneOffsetMinutes,
        });
      }
    } catch (error) {
      const rateLimitErrorMessage = error instanceof Error ? error.message : String(error);
      const rateLimitCategory: ObservabilityErrorCategory =
        rateLimitErrorMessage.toLowerCase().includes('timeout') || rateLimitErrorMessage.toLowerCase().includes('timed out')
          ? 'TIMEOUT'
          : 'BACKEND_UNAVAILABLE';

      requestLogger.warn('Recommend usage rate-limit backend unavailable', {
        jobId: queued.jobId,
        errorCategory: rateLimitCategory,
        error: toLogSafeError(error),
      });
      usageRateLimitDegraded = true;
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

      requestLogger.info('Recommend request completed within fast terminal wait window', {
        jobId: terminalJob.jobId,
        status: terminalJob.status,
      });

      const degradedResponse = terminalJob.status === 'failed' || usageRateLimitDegraded;
      const errorCategory: ObservabilityErrorCategory = degradedResponse ? 'BACKEND_UNAVAILABLE' : 'UNKNOWN_ERROR';
      logLifecycle(degradedResponse ? 'degraded' : 'success', {
        errorCode: degradedResponse
          ? String(result?.code || terminalJob.error || (usageRateLimitDegraded ? 'RATE_LIMIT_UNAVAILABLE' : 'RECOMMEND_JOB_FAILED'))
          : null,
        errorCategory: degradedResponse ? errorCategory : null,
        httpStatus: 200,
        terminalStatus: terminalJob.status,
        deduped: false,
      });

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
          errorCategory: degradedResponse ? errorCategory : undefined,
          degraded: degradedResponse,
          backendAvailable: !degradedResponse,
          usageRateLimitDegraded,
          completedAt: terminalJob.completedAt,
        },
        { status: 200, headers: { 'X-Request-Id': requestId } }
      );
    }

    requestLogger.info('Recommend request acknowledged with queued response', {
      jobId: queued.jobId,
      deduped: queued.deduped,
    });

    logLifecycle(usageRateLimitDegraded ? 'degraded' : 'success', {
      errorCode: usageRateLimitDegraded ? 'RATE_LIMIT_UNAVAILABLE' : null,
      errorCategory: usageRateLimitDegraded ? 'BACKEND_UNAVAILABLE' : null,
      httpStatus: 202,
      terminalStatus: 'queued',
      deduped: queued.deduped,
    });

    return NextResponse.json(
      {
        success: true,
        requestId,
        status: 'queued',
        jobId: queued.jobId,
        deduped: queued.deduped,
        usageRateLimitDegraded,
        message: queued.deduped
          ? 'Similar request already in progress or cached; attached to existing job.'
          : 'Recommendation job queued successfully.',
      },
      { status: 202, headers: { 'X-Request-Id': requestId } }
    );
  } catch (error) {
    if (queuedJobId) {
      try {
        await startRecommendJob(queuedJobId);
      } catch (recoveryError) {
        requestLogger.error('Failed to recover queued job after route exception', {
          jobId: queuedJobId,
          error: toLogSafeError(recoveryError),
        });
      }

      requestLogger.warn('Recommend route recovered by returning queued job after unexpected error', {
        jobId: queuedJobId,
        error: toLogSafeError(error),
      });

      logLifecycle('degraded', {
        errorCode: 'RECOMMEND_ROUTE_RECOVERED',
        errorCategory: 'BACKEND_UNAVAILABLE',
        httpStatus: 202,
        terminalStatus: 'queued',
        recovery: true,
      });

      return NextResponse.json(
        {
          success: true,
          requestId,
          status: 'queued',
          jobId: queuedJobId,
          deduped: false,
          degraded: true,
          backendAvailable: false,
          code: 'RECOMMEND_ROUTE_RECOVERED',
          errorCategory: 'BACKEND_UNAVAILABLE',
          recovery: true,
          message: 'Recommendation job queued while recovering from a transient server issue.',
        },
        { status: 202, headers: { 'X-Request-Id': requestId } }
      );
    }

    const mappedError = mapUnhandledRecommendError(error);

    requestLogger.error('Unhandled recommend route error', {
      status: mappedError.status,
      code: mappedError.code,
      error: toLogSafeError(error),
    });

    if (mappedError.status === 503) {
      logLifecycle('degraded', {
        errorCode: mappedError.code,
        errorCategory: mappedError.errorCategory,
        httpStatus: 200,
        backendAvailable: false,
        degraded: true,
      });

      return NextResponse.json(
        {
          success: true,
          requestId,
          status: 'failed',
          payload: null,
          fallbackSource: 'simplified',
          degraded: true,
          backendAvailable: false,
          code: mappedError.code,
          errorCategory: mappedError.errorCategory,
          error: mappedError.message,
          retryable: true,
        },
        {
          status: 200,
          headers: {
            'X-Request-Id': requestId,
          },
        }
      );
    }

    logLifecycle('error', {
      errorCode: mappedError.code,
      errorCategory: mappedError.errorCategory,
      httpStatus: mappedError.status,
    });

    return buildErrorResponse(
      mappedError.status,
      mappedError.code,
      mappedError.message,
      requestId,
      mappedError.errorCategory,
      {
        retryable: mappedError.status >= 500,
      }
    );
  }
}
