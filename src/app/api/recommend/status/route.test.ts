/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnforceRecommendAuth = jest.fn<(...args: any[]) => Promise<string | void>>();
const mockGetRecommendJobStatus = jest.fn<(...args: any[]) => Promise<null>>();

class MockAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

jest.mock('@/lib/recommend/request-guard', () => ({
  enforceRecommendAuth: (...args: any[]) => mockEnforceRecommendAuth(...args),
  AuthError: MockAuthError,
}));

jest.mock('@/lib/recommend/async-jobs', () => ({
  getRecommendJobStatus: (...args: any[]) => mockGetRecommendJobStatus(...args),
}));

import { GET } from './route';

describe('GET /api/recommend/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns MISSING_JOB_ID with request ID when jobId is absent', async () => {
    const response = await GET(
      new Request('http://localhost/api/recommend/status', {
        headers: {
          'x-request-id': 'req-status-missing-job',
        },
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('x-request-id')).toBe('req-status-missing-job');

    const payload = await response.json();
    expect(payload.code).toBe('MISSING_JOB_ID');
    expect(payload.requestId).toBe('req-status-missing-job');
  });

  it('returns JOB_NOT_FOUND with request ID when job is not visible', async () => {
    mockGetRecommendJobStatus.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/recommend/status?jobId=job-123&userId=anonymous', {
        headers: {
          'x-request-id': 'req-status-processing',
        },
      })
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('x-request-id')).toBe('req-status-processing');

    const payload = await response.json();
    expect(payload.code).toBe('JOB_NOT_FOUND');
    expect(payload.requestId).toBe('req-status-processing');
  });

  it('returns AUTH_ERROR with request ID when authenticated status check is denied', async () => {
    mockEnforceRecommendAuth.mockRejectedValue(new MockAuthError('Forbidden', 403));

    const response = await GET(
      new Request('http://localhost/api/recommend/status?jobId=job-789&userId=user-1', {
        headers: {
          authorization: 'Bearer token',
          'x-request-id': 'req-status-auth',
        },
      })
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('x-request-id')).toBe('req-status-auth');

    const payload = await response.json();
    expect(payload.code).toBe('AUTH_ERROR');
    expect(payload.requestId).toBe('req-status-auth');
  });
});
