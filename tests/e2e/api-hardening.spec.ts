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
        occasion: 'office',
        genre: 'minimalist',
        gender: 'male',
        userId: 'forged-user-id',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(String(body?.error || '').toLowerCase()).toContain('unauthorized');
  });

  test('recommend endpoint rejects cross-origin requests', async ({ request }) => {
    const response = await request.post('/api/recommend', {
      headers: {
        Origin: 'https://attacker.example',
      },
      data: {
        photoDataUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        occasion: 'office',
        genre: 'minimalist',
        gender: 'male',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(String(body?.error || '').toLowerCase()).toContain('origin');
  });

  test('recommend interaction endpoint rejects cross-origin requests', async ({ request }) => {
    const response = await request.post('/api/recommend/interaction', {
      headers: {
        Origin: 'https://attacker.example',
      },
      data: {
        event: 'results_visible',
        variant: 'A',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(String(body?.error || '').toLowerCase()).toContain('origin');
  });

  test('admin rate-limits endpoint rejects cross-origin delete requests', async ({ request }) => {
    const response = await request.fetch('/api/admin/rate-limits', {
      method: 'DELETE',
      headers: {
        Origin: 'https://attacker.example',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(String(body?.error || '').toLowerCase()).toContain('origin');
  });

  test('metrics snapshot endpoint rejects cross-origin post requests', async ({ request }) => {
    const response = await request.post('/api/recommend/metrics/snapshot', {
      headers: {
        Origin: 'https://attacker.example',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(String(body?.error || '').toLowerCase()).toContain('origin');
  });

  test('admin image-sources endpoint rejects cross-origin requests', async ({ request }) => {
    const response = await request.get('/api/admin/image-sources?probe=0', {
      headers: {
        Origin: 'https://attacker.example',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(String(body?.error || '').toLowerCase()).toContain('origin');
  });

  test('session endpoint rejects invalid body and delete clears safely', async ({ request }) => {
    const badCreate = await request.post('/api/auth/session', {
      data: {
        invalid: true,
      },
      headers: {
        Origin: 'http://localhost:3000',
      },
    });

    expect(badCreate.status()).toBe(400);

    const clearSession = await request.fetch('/api/auth/session', {
      method: 'DELETE',
      headers: {
        Origin: 'http://localhost:3000',
      },
    });

    expect(clearSession.status()).toBe(200);
    const clearBody = await clearSession.json();
    expect(clearBody.ok).toBe(true);
  });

  test('session endpoint rejects cross-origin session creation and clear', async ({ request }) => {
    const forgedCreate = await request.post('/api/auth/session', {
      data: {
        idToken: 'fake-token',
      },
      headers: {
        Origin: 'https://attacker.example',
      },
    });

    expect(forgedCreate.status()).toBe(403);
    const createBody = await forgedCreate.json();
    expect(String(createBody?.error || '').toLowerCase()).toContain('origin');

    const forgedDelete = await request.fetch('/api/auth/session', {
      method: 'DELETE',
      headers: {
        Origin: 'https://attacker.example',
      },
    });

    expect(forgedDelete.status()).toBe(403);
    const deleteBody = await forgedDelete.json();
    expect(String(deleteBody?.error || '').toLowerCase()).toContain('origin');
  });

  test('protected route redirects when session cookie is invalid', async ({ request }) => {
    const response = await request.fetch('/analytics', {
      headers: {
        Cookie: 'smartstyle-session=invalid.jwt.structure',
      },
      maxRedirects: 0,
    });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()['location']).toContain('/auth');
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

  test('tavily endpoint rejects cross-origin requests', async ({ request }) => {
    const response = await request.post('/api/tavily/search', {
      headers: {
        Origin: 'https://attacker.example',
      },
      data: {
        query: 'blue cotton shirt',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(String(body?.error || '').toLowerCase()).toContain('origin');
  });
});
