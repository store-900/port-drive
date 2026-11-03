import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'vault_super_secret_jwt_key_2026';
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith('/admin');
  const isLoginPage = pathname === '/admin/login';
  const isRootPage = pathname === '/';

  // Read admin_token from cookies
  const token = request.cookies.get('admin_token')?.value;

  let isValidAdmin = false;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey);
      if (payload && (payload.role === 'SUPER_ADMIN' || payload.role === 'admin')) {
        isValidAdmin = true;
      }
    } catch {
      isValidAdmin = false;
    }
  }

  // 1. Root path (/) -> Redirect directly to admin dashboard if logged in, or login page if not
  if (isRootPage) {
    if (isValidAdmin) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // 2. If accessing /admin or any protected subpath without a valid admin token:
  // Immediately redirect to /admin/login before rendering any HTML or page content!
  if (isAdminRoute && !isLoginPage) {
    if (!isValidAdmin) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      if (token) {
        response.cookies.delete('admin_token');
      }
      return response;
    }
  }

  // 3. If already logged in and visiting /admin/login, redirect directly to /admin
  if (isLoginPage && isValidAdmin) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
  ],
};
