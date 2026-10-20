import { Resend } from 'resend';

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function sendVerificationEmail({ to, name, url }) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY belum diset');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM || 'Rekap Reimburse <onboarding@resend.dev>',
    ...(process.env.RESEND_REPLY_TO ? { replyTo: process.env.RESEND_REPLY_TO } : {}),
    to,
    subject: 'Verifikasi akun Rekap Reimburse',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
        <h2 style="color:#0f766e">Rekap Reimburse</h2>
        <p>Halo ${escapeHtml(name)},</p>
        <p>Terima kasih sudah mendaftar. Klik tombol di bawah untuk memverifikasi email Anda:</p>
        <p style="margin:28px 0">
          <a href="${url}" style="background:#0f766e;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Verifikasi Email</a>
        </p>
        <p style="font-size:13px;color:#6b7280">Link berlaku 24 jam. Jika tombol tidak berfungsi, salin link ini ke browser:<br>${url}</p>
        <p style="font-size:13px;color:#6b7280">Abaikan email ini jika Anda tidak merasa mendaftar.</p>
      </div>`,
  });
  if (error) throw new Error(error.message || 'Gagal mengirim email');
}
