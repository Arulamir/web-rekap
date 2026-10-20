import { db } from '@/lib/db';
import { hashToken } from '@/lib/auth';

export async function GET(req) {
  const raw = new URL(req.url).searchParams.get('token') || '';
  let ok = false;
  if (/^[a-f0-9]{64}$/.test(raw)) {
    const sql = await db();
    const rows = await sql`
      UPDATE users SET email_verified = TRUE, verify_token = NULL, verify_expires = NULL
      WHERE verify_token = ${hashToken(raw)} AND verify_expires > NOW()
      RETURNING id`;
    ok = rows.length > 0;
  }
  return Response.redirect(new URL(`/login?verified=${ok ? '1' : '0'}`, req.url), 303);
}
