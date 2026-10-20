import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifyToken } from './lib/session.js';

export async function middleware(req) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return NextResponse.redirect(new URL('/login', req.url));
  if (req.nextUrl.pathname.startsWith('/admin') && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*'] };
