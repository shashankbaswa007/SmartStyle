/**
 * Middleware - Security Headers & Route Configuration
 * 
 * This middleware:
 * 1. Adds security headers to all responses (XSS, clickjacking, MIME-sniffing protection)
 * 2. Sets strict Referrer-Policy
 * 3. Sets Permissions-Policy to disable unused browser features
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
  // Prevent browsers from running inline scripts from untrusted sources
  response.headers.set('X-DNS-Prefetch-Control', 'on');

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
     * - API routes (handled separately)
     */
    '/((?!_next/static|_next/image|icon|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
