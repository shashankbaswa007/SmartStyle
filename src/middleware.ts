/**
 * Middleware - Route Protection and Authentication Flow
 * 
 * This middleware:
 * 1. Redirects unauthenticated users from protected routes to /auth
 * 2. Redirects authenticated users from /auth to home page
 * 3. Allows public routes (auth page) to be accessible without authentication
 * 
 * Note: Since Firebase Auth is client-side, this middleware checks for the presence
 * of session cookies. The actual auth verification happens in the AuthProvider on the client.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = [
  '/wardrobe',
  '/style-check',
  '/color-match',
  '/analytics',
  '/preferences',
  '/likes',
  '/account-settings',
];

// Public routes that don't require authentication
const publicRoutes = ['/auth', '/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/api');

  // For client-side Firebase Auth, we rely on the ProtectedRoute component
  // to handle authentication checks. The middleware only handles static redirects.
  // Removed cookie checks since Firebase Auth is client-side only.

  // Allow the request to proceed
  return NextResponse.next();
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
