import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { SESSION_COOKIE, verifyToken } from './session.js';

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}

// Token verifikasi: kirim versi mentah lewat email, simpan hash-nya di database.
export function newVerifyToken() {
  const raw = randomBytes(32).toString('hex');
  return { raw, hash: hashToken(raw), expires: new Date(Date.now() + 24 * 60 * 60 * 1000) };
}

export function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

export function appUrl(req) {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, '');
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
