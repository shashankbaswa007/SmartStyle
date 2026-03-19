import { test, expect } from '@playwright/test';

test.describe('API Hardening', () => {
  test('recommend endpoint rejects malformed JSON safely', async ({ request }) => {
    const response = await request.fetch('/api/recommend', {
      method: 'POST',
      data: 'not-json',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    const normalizedError = String(body?.error || body?.details || body?.message || '').toLowerCase();
    expect(normalizedError.length).toBeGreaterThan(0);
  });

  test('tavily endpoint requires auth and returns safe fallback shape', async ({ request }) => {
    const response = await request.post('/api/tavily/search', {
      data: {
        query: 'blue cotton shirt',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toMatch(/unauthorized/i);
    expect(body.links).toBeTruthy();
  });
});
