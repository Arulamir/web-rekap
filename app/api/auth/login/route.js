import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createToken, cookieOptions, SESSION_COOKIE } from '@/lib/session';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  const sql = await db();
  const [user] = await sql`SELECT id, name, email, password_hash, role, email_verified FROM users WHERE email = ${email}`;
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 });
  }
  if (!user.email_verified) {
    return NextResponse.json({ error: 'Email belum diverifikasi. Cek inbox Anda.', unverified: true }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, await createToken(user), cookieOptions);
  return res;
}
