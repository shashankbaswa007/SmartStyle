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

  test('recommend endpoint blocks forged personalized requests without token', async ({ request }) => {
    const response = await request.post('/api/recommend', {
      data: {
        photoDataUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        gender: 'male',
        userId: 'forged-user-id',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(String(body?.error || '').toLowerCase()).toContain('unauthorized');
  });

  test('session endpoint rejects invalid body and delete clears safely', async ({ request }) => {
    const badCreate = await request.post('/api/auth/session', {
      data: {
        invalid: true,
      },
    });

    expect(badCreate.status()).toBe(400);

    const clearSession = await request.fetch('/api/auth/session', {
      method: 'DELETE',
    });

    expect(clearSession.status()).toBe(200);
    const clearBody = await clearSession.json();
    expect(clearBody.ok).toBe(true);
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
