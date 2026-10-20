import { db } from '@/lib/db';
import { json, newVerifyToken, appUrl } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const sql = await db();
  const [user] = await sql`SELECT id, name, email_verified FROM users WHERE email = ${email}`;
  if (user && !user.email_verified) {
    const token = newVerifyToken();
    await sql`UPDATE users SET verify_token = ${token.hash}, verify_expires = ${token.expires} WHERE id = ${user.id}`;
    try {
      await sendVerificationEmail({ to: email, name: user.name, url: `${appUrl(req)}/api/auth/verify?token=${token.raw}` });
    } catch (err) {
      console.error('SMTP email error:', { code: err.code, responseCode: err.responseCode });
      return json({ error: `Gagal mengirim email: ${err.message}` }, 502);
    }
  }
  return json({ ok: true, message: 'Jika email terdaftar dan belum terverifikasi, link baru telah dikirim.' });
}
