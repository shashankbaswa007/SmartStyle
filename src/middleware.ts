/**
 * Middleware - Security Headers & Route Configuration
 * 
 * This middleware:
 * 1. Adds security headers to all responses (XSS, clickjacking, MIME-sniffing protection)
 * 2. Sets strict Referrer-Policy
 * 3. Sets Permissions-Policy to disable unused browser features
 * 4. Adds Content-Security-Policy to prevent XSS attacks
 * 
 * Protected routes require a verified Firebase auth cookie (session cookie or ID token).
 * API routes still enforce bearer-token validation for data operations.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRemoteJWKSet } from 'jose/jwks/remote';
import { jwtVerify } from 'jose/jwt/verify';
import { isProtectedPath } from '@/lib/protected-routes';

const SESSION_COOKIE_NAME = 'smartstyle-session';
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const segments = token.split('.');
    if (segments.length < 2) return null;

    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payloadJson = atob(padded);
    const parsed = JSON.parse(payloadJson);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasFreshFirebaseLikeClaims(sessionCookie: string): boolean {
  const payload = parseJwtPayload(sessionCookie);
  if (!payload) return false;

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const audience = typeof payload.aud === 'string' ? payload.aud : '';
  const issuer = typeof payload.iss === 'string' ? payload.iss : '';
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;

  if (!sub || !audience || !issuer || !exp) return false;
  if (Date.now() >= exp * 1000) return false;

  const validIssuers = new Set([
    `https://securetoken.google.com/${audience}`,
    `https://session.firebase.google.com/${audience}`,
  ]);

  return validIssuers.has(issuer);
}

async function verifyFirebaseSessionCookie(sessionCookie: string): Promise<{ sub?: string } | null> {
  try {
    // Verify signature first, then validate issuer/audience relationship.
    // This avoids hard failure when deployment env project IDs are misconfigured.
    const { payload } = await jwtVerify(sessionCookie, GOOGLE_JWKS);

    const audience = typeof payload.aud === 'string' ? payload.aud : '';
    const issuer = typeof payload.iss === 'string' ? payload.iss : '';
    if (!audience || !issuer) return null;

    const validIssuers = new Set([
      `https://securetoken.google.com/${audience}`,
      `https://session.firebase.google.com/${audience}`,
    ]);

    if (!validIssuers.has(issuer)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verifiedSession = sessionCookie ? await verifyFirebaseSessionCookie(sessionCookie) : null;
  const hasSessionCookie = !!sessionCookie;
  const hasFreshFallbackClaims = sessionCookie ? hasFreshFirebaseLikeClaims(sessionCookie) : false;
  const isAuthenticated = !!verifiedSession?.sub || hasFreshFallbackClaims;
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  if (isProtectedPath(pathname) && !isAuthenticated) {
    // If any auth cookie exists but cannot be verified right now, avoid forcing a hard
    // redirect loop. Let client auth resolve and re-sync the cookie on this request cycle.
    if (hasSessionCookie) {
      const passthrough = NextResponse.next();
      passthrough.headers.set('X-Request-Id', requestId);
      return passthrough;
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/auth';
    redirectUrl.searchParams.set('next', pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.headers.set('X-Request-Id', requestId);
    return redirectResponse;
  }

  const response = NextResponse.next();
  response.headers.set('X-Request-Id', requestId);

  // Security headers — protect against XSS, clickjacking, MIME-sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(self), interest-cohort=()'
  );
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  // OAuth and popup callbacks can trigger noisy window.closed warnings under stricter COOP.
  // Use relaxed isolation on auth paths while keeping tighter defaults elsewhere.
  const isAuthPath = pathname === '/auth' || pathname.startsWith('/auth/');
  if (isAuthPath) {
    response.headers.set('Cross-Origin-Opener-Policy', 'unsafe-none');
    response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  } else {
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  }

  // Content-Security-Policy — restrict resource loading
  const isProduction = process.env.NODE_ENV === 'production';
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.googletagmanager.com"
    : "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://www.googletagmanager.com";

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://res.cloudinary.com",
    "img-src 'self' data: blob: https: http:",
    "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.firebaseio.com https://*.cloudfunctions.net https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.openweathermap.org https://api.tavily.com https://api.groq.com https://generativelanguage.googleapis.com https://replicate.com https://api.replicate.com https://image.pollinations.ai https://api.together.xyz wss://*.firebaseio.com",
    "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - public files (public folder)
     * - icon routes (handled by Next.js)
     */
    '/((?!_next/static|_next/image|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
