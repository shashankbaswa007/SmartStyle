import { describe, expect, it } from '@jest/globals';
import { getAllowedOrigins, validateRequestOrigin } from '@/lib/csrf-protection';

function mockRequest(url: string, origin?: string): Request {
  const headerMap = new Map<string, string>();
  if (origin) {
    headerMap.set('origin', origin);
  }

  return {
    url,
    headers: {
      get(name: string) {
        return headerMap.get(name.toLowerCase()) ?? null;
      },
    } as Headers,
  } as Request;
}

describe('csrf-protection', () => {
  it('allows requests without origin header (non-browser clients)', () => {
    const req = mockRequest('https://smartstyle.example/api/auth/session');

    expect(validateRequestOrigin(req)).toBe(true);
  });

  it('accepts same-origin browser request', () => {
    const req = mockRequest('https://smartstyle.example/api/auth/session', 'https://smartstyle.example');

    expect(validateRequestOrigin(req)).toBe(true);
  });

  it('rejects mismatched browser origin', () => {
    const req = mockRequest('https://smartstyle.example/api/auth/session', 'https://attacker.example');

    expect(validateRequestOrigin(req)).toBe(false);
  });

  it('includes configured app URL in allowed origins', () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.smartstyle.example';

    try {
      const req = mockRequest('https://smartstyle.example/api/auth/session');
      const origins = getAllowedOrigins(req);
      expect(origins.has('https://app.smartstyle.example')).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_APP_URL = original;
      }
    }
  });
});
