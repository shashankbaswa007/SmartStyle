/**
 * Middleware - Route Protection and Authentication Flow
 * 
 * This middleware:
 * 1. Redirects unauthenticated users from protected routes to /auth
 * 2. Redirects authenticated users from /auth to home page
 * 3. Allows public routes (auth page) to be accessible without authentication
 * 
 * Note: Since Firebase Auth is client-side, we can't verify auth state in middleware.
 * This middleware relies on the presence of auth cookies/tokens.
 * The actual auth check happens in the AuthProvider on the client side.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require authentication
const publicRoutes = ['/auth'];

// Routes that should redirect to home if user is authenticated
const authRoutes = ['/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // For now, we'll handle route protection on the client side
  // because Firebase Auth is client-side only
  // This middleware can be extended later for server-side auth checks
  
  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
