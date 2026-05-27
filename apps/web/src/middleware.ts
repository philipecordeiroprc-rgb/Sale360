import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isCatalogPath(pathname: string): boolean {
  if (pathname === '/') return false;
  if (pathname.startsWith('/c/')) return true; // backward compat
  const APP_SEGMENTS = new Set([
    'login', 'forgot-password', 'reset-password', 'select-store',
    'dashboard', 'admin', 'coupons', 'customers', 'finance',
    'guia-importacao', 'indicadores', 'inventory', 'orders',
    'products', 'purchases', 'settings', 'suppliers', 'tutoriais',
  ]);
  const first = pathname.split('/')[1];
  if (!first) return false;
  return !APP_SEGMENTS.has(first);
}

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
  const isSelectStore = pathname.startsWith('/select-store');
  const isCatalogRoute = isCatalogPath(pathname);
  const isGuiaImportacao = pathname.startsWith('/guia-importacao');

  // SUPER_ADMIN with active tenant cookie → in store mode
  const hasTenant = !!request.cookies.get('sale360_tenant')?.value;

  // Public routes (no auth required)
  if (pathname === '/login' || isForgotPassword || isResetPassword || isCatalogRoute || isGuiaImportacao) {
    if (token && pathname === '/login') {
      // SUPER_ADMIN with stores goes to select-store, otherwise to /admin
      if (isSuperAdmin && hasTenant) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
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

  // Allow store selector for authenticated users
  if (isSelectStore) {
    return NextResponse.next();
  }

  // SUPER_ADMIN in store mode: allow store pages, don't force redirect to /admin
  if (isSuperAdmin && hasTenant && !isAdminRoute) {
    return NextResponse.next();
  }

  // SUPER_ADMIN in admin mode: redirect non-admin pages to /admin
  if (isSuperAdmin && !isAdminRoute && !isCatalogRoute) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Block non-SUPER_ADMIN from /admin
  if (isAdminRoute && !isSuperAdmin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|templates|favicon\\.ico|sitemap\\.xml|robots\\.txt|manifest\\.json|.*\\.png|.*\\.svg|.*\\.ico|.*\\.csv|.*\\.md).*)'],
};
