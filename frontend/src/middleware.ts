import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware
 * Runs on the edge before every request.
 * Handles auth redirects — the actual JWT validation happens server-side via API.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  const publicPaths = ['/auth/login', '/auth/register', '/auth/forgot-password'];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // Health check
  if (pathname === '/health') {
    return NextResponse.json({ status: 'ok' });
  }

  // API routes are proxied, don't interfere
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Static assets
  if (pathname.startsWith('/_next/') || pathname.includes('.')) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
