import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { ADMIN_EMAIL } from '@/lib/schema';
import { json, newVerifyToken, appUrl, EMAIL_RE } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (name.length < 2 || name.length > 100) return json({ error: 'Nama minimal 2 karakter.' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'Format email tidak valid.' }, 400);
  if (password.length < 8) return json({ error: 'Password minimal 8 karakter.' }, 400);
  if (email === ADMIN_EMAIL) return json({ error: 'Email ini tidak dapat didaftarkan.' }, 400);

  const sql = await db();
  const [existing] = await sql`SELECT id, email_verified FROM users WHERE email = ${email}`;
  if (existing?.email_verified) return json({ error: 'Email sudah terdaftar. Silakan login.' }, 409);

  const hash = await bcrypt.hash(password, 10);
  const token = newVerifyToken();
  if (existing) {
    await sql`
      UPDATE users SET name = ${name}, password_hash = ${hash},
        verify_token = ${token.hash}, verify_expires = ${token.expires}
      WHERE id = ${existing.id}`;
  } else {
    await sql`
      INSERT INTO users (name, email, password_hash, verify_token, verify_expires)
      VALUES (${name}, ${email}, ${hash}, ${token.hash}, ${token.expires})`;
  }

  try {
    await sendVerificationEmail({ to: email, name, url: `${appUrl(req)}/api/auth/verify?token=${token.raw}` });
  } catch (err) {
    console.error('SMTP email error:', { code: err.code, responseCode: err.responseCode });
    return json({ error: `Akun dibuat, tetapi email verifikasi gagal dikirim: ${err.message}` }, 502);
  }
  return json({ ok: true, message: `Link verifikasi telah dikirim ke ${email}. Cek inbox/spam Anda.` });
}
