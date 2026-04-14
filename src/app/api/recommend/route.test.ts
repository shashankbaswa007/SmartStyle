/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockValidateRequest = jest.fn();
const mockFormatValidationError = jest.fn();
const mockSanitizePromptText = jest.fn((value: string) => value);
const mockQuickValidateImageDataUri = jest.fn();
const mockValidateRequestOrigin = jest.fn<(...args: any[]) => boolean>();
const mockEnforceRecommendAuth = jest.fn();
const mockEnforceRecommendRateLimit = jest.fn<
  (...args: any[]) => Promise<{
    effectiveUserId: string;
    rateLimit: {
      allowed: boolean;
      remaining: number;
      resetAt: Date;
      message?: string;
    };
  }>
>();
const mockEnqueueRecommendJob = jest.fn<
  (...args: any[]) => Promise<{
    jobId: string;
    deduped: boolean;
    status: string;
  }>
>();
const mockMarkRecommendJobRateLimited = jest.fn();
const mockSetRecommendJobUsageReservation = jest.fn();
const mockStartRecommendJob = jest.fn();
const mockAwaitRecommendJobTerminalState = jest.fn<(...args: any[]) => Promise<null | { status: string }>>();

jest.mock('@/lib/validation', () => ({
  recommendRequestSchema: {},
  validateRequest: (...args: unknown[]) => mockValidateRequest(...args),
  formatValidationError: (...args: unknown[]) => mockFormatValidationError(...args),
  sanitizePromptText: (...args: [string]) => mockSanitizePromptText(...args),
  MAX_IMAGE_DATA_URI_CHARS: 10_000_000,
}));

jest.mock('@/lib/server-image-validation', () => ({
  quickValidateImageDataUri: (...args: unknown[]) => mockQuickValidateImageDataUri(...args),
}));

jest.mock('@/lib/csrf-protection', () => ({
  validateRequestOrigin: (...args: unknown[]) => mockValidateRequestOrigin(...args),
}));

class MockAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

jest.mock('@/lib/recommend/request-guard', () => ({
  enforceRecommendAuth: (...args: unknown[]) => mockEnforceRecommendAuth(...args),
  enforceRecommendRateLimit: (...args: any[]) => mockEnforceRecommendRateLimit(...args),
  AuthError: MockAuthError,
}));

jest.mock('@/lib/recommend/async-jobs', () => ({
  enqueueRecommendJob: (...args: any[]) => mockEnqueueRecommendJob(...args),
  markRecommendJobRateLimited: (...args: unknown[]) => mockMarkRecommendJobRateLimited(...args),
  setRecommendJobUsageReservation: (...args: unknown[]) => mockSetRecommendJobUsageReservation(...args),
  startRecommendJob: (...args: unknown[]) => mockStartRecommendJob(...args),
  awaitRecommendJobTerminalState: (...args: any[]) => mockAwaitRecommendJobTerminalState(...args),
  RECOMMEND_JOB_TIMEOUT_MS: 60_000,
}));

import { POST } from './route';

const originalNodeEnv = process.env.NODE_ENV;
const originalGroqApiKey = process.env.GROQ_API_KEY;
const originalGoogleGenAiApiKey = process.env.GOOGLE_GENAI_API_KEY;

describe('POST /api/recommend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateRequestOrigin.mockReturnValue(true);
    mockFormatValidationError.mockReturnValue({ success: false, code: 'INVALID_REQUEST' });
    mockEnforceRecommendRateLimit.mockResolvedValue({
      effectiveUserId: 'anonymous',
      rateLimit: {
        allowed: true,
        remaining: 9,
        resetAt: new Date(Date.now() + 60_000),
      },
    });
    mockAwaitRecommendJobTerminalState.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;

    if (typeof originalGroqApiKey === 'undefined') {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalGroqApiKey;
    }

    if (typeof originalGoogleGenAiApiKey === 'undefined') {
      delete process.env.GOOGLE_GENAI_API_KEY;
    } else {
      process.env.GOOGLE_GENAI_API_KEY = originalGoogleGenAiApiKey;
    }
  });

  it('returns 503 in production when recommendation provider env vars are missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GROQ_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;

    const response = await POST(
      new Request('http://localhost/api/recommend', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-missing-env',
        },
        body: JSON.stringify({
          photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
          occasion: 'office',
          genre: 'minimalist',
          gender: 'male',
          userId: 'anonymous',
        }),
      })
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('x-request-id')).toBe('req-missing-env');

    const payload = await response.json();
    expect(payload.code).toBe('RECOMMEND_BACKEND_MISCONFIGURED');
    expect(payload.errorCategory).toBe('ENV_MISCONFIGURED');
    expect(payload.missingCritical).toContain('GROQ_API_KEY or GOOGLE_GENAI_API_KEY');
  });

  it('rejects cross-origin request before processing payload', async () => {
    mockValidateRequestOrigin.mockReturnValue(false);

    const response = await POST(
      new Request('http://localhost/api/recommend', {
        method: 'POST',
        headers: {
          origin: 'https://attacker.example',
          'x-request-id': 'req-invalid-origin',
        },
        body: '{}',
      })
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('x-request-id')).toBe('req-invalid-origin');

    const payload = await response.json();
    expect(payload.code).toBe('INVALID_ORIGIN');
    expect(payload.errorCategory).toBe('UNKNOWN_ERROR');
    expect(String(payload.error || '').toLowerCase()).toContain('origin');
    expect(mockValidateRequest).not.toHaveBeenCalled();
  });

  it('returns INVALID_JSON with request ID header/body when request body is malformed', async () => {
    const response = await POST(
      new Request('http://localhost/api/recommend', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-invalid-json',
        },
        body: '{',
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('x-request-id')).toBe('req-invalid-json');

    const payload = await response.json();
    expect(payload.code).toBe('INVALID_JSON');
    expect(payload.errorCategory).toBe('UNKNOWN_ERROR');
    expect(payload.requestId).toBe('req-invalid-json');
  });

  it('returns deduped queued response with request ID when matching job already exists', async () => {
    mockValidateRequest.mockReturnValue({
      success: true,
      data: {
        photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
        occasion: 'office',
        genre: 'minimalist',
        gender: 'male',
        userId: 'anonymous',
      },
    });
    mockQuickValidateImageDataUri.mockReturnValue({ isValid: true });
    mockEnqueueRecommendJob.mockResolvedValue({
      jobId: 'job-deduped',
      deduped: true,
      status: 'queued',
    });

    const response = await POST(
      new Request('http://localhost/api/recommend', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-deduped',
        },
        body: JSON.stringify({
          photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
          occasion: 'office',
          genre: 'minimalist',
          gender: 'male',
          userId: 'anonymous',
        }),
      })
    );

    expect(response.status).toBe(202);
    expect(response.headers.get('x-request-id')).toBe('req-deduped');

    const payload = await response.json();
    expect(payload.requestId).toBe('req-deduped');
    expect(payload.status).toBe('queued');
    expect(payload.deduped).toBe(true);

    expect(mockEnqueueRecommendJob).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'anonymous', occasion: 'office', genre: 'minimalist' }),
      'anonymous',
      expect.objectContaining({ requestId: 'req-deduped', autoStart: false })
    );
  });

  it('returns 429 with retry headers when usage limit is exceeded', async () => {
    mockValidateRequest.mockReturnValue({
      success: true,
      data: {
        photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
        occasion: 'office',
        genre: 'minimalist',
        gender: 'male',
        userId: 'anonymous',
      },
    });
    mockQuickValidateImageDataUri.mockReturnValue({ isValid: true });
    mockEnqueueRecommendJob.mockResolvedValue({
      jobId: 'job-rate-limit',
      deduped: false,
      status: 'queued',
    });

    const resetAt = new Date(Date.now() + 30_000);
    mockEnforceRecommendRateLimit.mockResolvedValue({
      effectiveUserId: 'anonymous',
      rateLimit: {
        allowed: false,
        remaining: 0,
        resetAt,
        message: 'Daily limit reached',
      },
    });

    const response = await POST(
      new Request('http://localhost/api/recommend', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-rate-limited',
        },
        body: JSON.stringify({
          photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
          occasion: 'office',
          genre: 'minimalist',
          gender: 'male',
          userId: 'anonymous',
        }),
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('x-request-id')).toBe('req-rate-limited');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(response.headers.get('retry-after')).toBeTruthy();

    const payload = await response.json();
    expect(payload.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(payload.errorCategory).toBe('UNKNOWN_ERROR');
    expect(payload.requestId).toBe('req-rate-limited');
    expect(mockMarkRecommendJobRateLimited).toHaveBeenCalledWith('job-rate-limit', 'Daily limit reached');
  });

  it('returns queued quickly for non-terminal jobs and uses fast terminal wait window', async () => {
    mockValidateRequest.mockReturnValue({
      success: true,
      data: {
        photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
        occasion: 'office',
        genre: 'minimalist',
        gender: 'male',
        userId: 'anonymous',
      },
    });
    mockQuickValidateImageDataUri.mockReturnValue({ isValid: true });
    mockEnqueueRecommendJob.mockResolvedValue({
      jobId: 'job-queued',
      deduped: false,
      status: 'queued',
    });
    mockAwaitRecommendJobTerminalState.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/recommend', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-queued-fast-ack',
        },
        body: JSON.stringify({
          photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
          occasion: 'office',
          genre: 'minimalist',
          gender: 'male',
          userId: 'anonymous',
        }),
      })
    );

    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload.status).toBe('queued');
    expect(payload.requestId).toBe('req-queued-fast-ack');
    expect(mockStartRecommendJob).toHaveBeenCalledWith('job-queued');
    expect(mockAwaitRecommendJobTerminalState).toHaveBeenCalledWith(
      'job-queued',
      expect.objectContaining({ timeoutMs: 6500, pollIntervalMs: 550 })
    );
  });

  it('returns queued recovery response when unexpected errors happen after enqueue', async () => {
    mockValidateRequest.mockReturnValue({
      success: true,
      data: {
        photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
        occasion: 'office',
        genre: 'minimalist',
        gender: 'male',
        userId: 'anonymous',
      },
    });
    mockQuickValidateImageDataUri.mockReturnValue({ isValid: true });
    mockEnqueueRecommendJob.mockResolvedValue({
      jobId: 'job-recovery',
      deduped: false,
      status: 'queued',
    });
    mockAwaitRecommendJobTerminalState.mockRejectedValue(new Error('terminal wait failed'));

    const response = await POST(
      new Request('http://localhost/api/recommend', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-route-recovery',
        },
        body: JSON.stringify({
          photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
          occasion: 'office',
          genre: 'minimalist',
          gender: 'male',
          userId: 'anonymous',
        }),
      })
    );

    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload.requestId).toBe('req-route-recovery');
    expect(payload.status).toBe('queued');
    expect(payload.jobId).toBe('job-recovery');
    expect(payload.recovery).toBe(true);
    expect(mockStartRecommendJob).toHaveBeenCalledWith('job-recovery');
  });

  it('returns structured 500 when enqueue fails before job creation', async () => {
    mockValidateRequest.mockReturnValue({
      success: true,
      data: {
        photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
        occasion: 'office',
        genre: 'minimalist',
        gender: 'male',
        userId: 'anonymous',
      },
    });
    mockQuickValidateImageDataUri.mockReturnValue({ isValid: true });
    mockEnqueueRecommendJob.mockRejectedValue(new Error('queue unavailable'));

    const response = await POST(
      new Request('http://localhost/api/recommend', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-enqueue-failure',
        },
        body: JSON.stringify({
          photoDataUri: 'data:image/jpeg;base64,ZmFrZQ==',
          occasion: 'office',
          genre: 'minimalist',
          gender: 'male',
          userId: 'anonymous',
        }),
      })
    );

    expect(response.status).toBe(500);
    expect(response.headers.get('x-request-id')).toBe('req-enqueue-failure');

    const payload = await response.json();
    expect(payload.code).toBe('RECOMMEND_REQUEST_FAILED');
    expect(payload.errorCategory).toBe('UNKNOWN_ERROR');
    expect(payload.requestId).toBe('req-enqueue-failure');
    expect(payload.retryable).toBe(true);
  });
});
