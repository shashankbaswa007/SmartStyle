/**
 * Middleware - Security Headers & Route Configuration
 * 
 * This middleware:
 * 1. Adds security headers to all responses (XSS, clickjacking, MIME-sniffing protection)
 * 2. Sets strict Referrer-Policy
 * 3. Sets Permissions-Policy to disable unused browser features
 * 4. Adds Content-Security-Policy to prevent XSS attacks
 * 
 * Note: Firebase Auth is client-side. Actual auth enforcement happens via the
 * <ProtectedRoute> component and API-level token verification.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

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

  // Content-Security-Policy — restrict resource loading
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
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
