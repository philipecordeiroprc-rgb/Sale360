import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('sale360_token')?.value;
  const userStr = request.cookies.get('sale360_user')?.value;
  const { pathname } = request.nextUrl;

  // Parse user role from cookie
  let userRole = '';
  try {
    if (userStr) {
      const user = JSON.parse(decodeURIComponent(userStr));
      userRole = user.role || '';
    }
  } catch { /* ignore */ }

  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isAdminRoute = pathname.startsWith('/admin');
  const isForgotPassword = pathname.startsWith('/forgot-password');
  const isResetPassword = pathname.startsWith('/reset-password');

  // Public routes (no auth required)
  if (pathname === '/login' || isForgotPassword || isResetPassword) {
    if (token && pathname === '/login') {
      return NextResponse.redirect(new URL(isSuperAdmin ? '/admin' : '/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Redirect to login if no token
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // SUPER_ADMIN redirect to /admin from non-admin pages
  if (isSuperAdmin && !isAdminRoute) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Block non-SUPER_ADMIN from /admin
  if (isAdminRoute && !isSuperAdmin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon\\.ico|sitemap\\.xml|robots\\.txt|manifest\\.json|.*\\.png|.*\\.svg|.*\\.ico).*)'],
};
