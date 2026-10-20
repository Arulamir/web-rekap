import nodemailer from 'nodemailer';

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function sendVerificationEmail({ to, name, url }) {
  for (const key of ['SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']) {
    if (!process.env[key]?.trim()) throw new Error(`${key} belum diset`);
  }
  const port = Number(process.env.SMTP_PORT || 587);
  if (![587, 465, 2525].includes(port)) throw new Error('SMTP_PORT harus 587, 465, atau 2525');
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  const result = await transport.sendMail({
    from: process.env.SMTP_FROM,
    ...(process.env.SMTP_REPLY_TO ? { replyTo: process.env.SMTP_REPLY_TO } : {}),
    to,
    subject: 'Verifikasi akun Rekap Reimburse',
    text: `Halo ${name},\n\nVerifikasi akun Rekap Reimburse Anda melalui tautan berikut:\n${url}\n\nLink berlaku 24 jam. Abaikan email ini jika Anda tidak merasa mendaftar.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
        <h2 style="color:#0f766e">Rekap Reimburse</h2>
        <p>Halo ${escapeHtml(name)},</p>
        <p>Terima kasih sudah mendaftar. Klik tombol di bawah untuk memverifikasi email Anda:</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(url)}" style="background:#0f766e;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Verifikasi Email</a>
        </p>
        <p style="font-size:13px;color:#6b7280">Link berlaku 24 jam. Jika tombol tidak berfungsi, salin link ini ke browser:<br>${escapeHtml(url)}</p>
        <p style="font-size:13px;color:#6b7280">Abaikan email ini jika Anda tidak merasa mendaftar.</p>
      </div>`,
  });
  if (!result.accepted?.length || result.rejected?.length) {
    throw new Error('Server SMTP tidak menerima penerima email');
  }
}
