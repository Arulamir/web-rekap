import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

export async function POST(req) {
  const res = NextResponse.redirect(new URL('/login', req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
