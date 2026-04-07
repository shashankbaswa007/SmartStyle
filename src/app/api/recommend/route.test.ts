/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockValidateRequest = jest.fn();
const mockFormatValidationError = jest.fn();
const mockSanitizePromptText = jest.fn((value: string) => value);
const mockQuickValidateImageDataUri = jest.fn();
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
  startRecommendJob: (...args: unknown[]) => mockStartRecommendJob(...args),
  awaitRecommendJobTerminalState: (...args: any[]) => mockAwaitRecommendJobTerminalState(...args),
  RECOMMEND_JOB_TIMEOUT_MS: 60_000,
}));

import { POST } from './route';

describe('POST /api/recommend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
