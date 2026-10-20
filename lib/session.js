import { SignJWT, jwtVerify } from 'jose';

// File ini juga dipakai middleware (edge runtime), jadi jangan impor modul Node.
export const SESSION_COOKIE = 'rr_session';
const MAX_AGE = 60 * 60 * 24 * 7;

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET belum diset');
  return new TextEncoder().encode(secret);
}

export async function createToken(user) {
  return new SignJWT({ id: user.id, name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: MAX_AGE,
};
