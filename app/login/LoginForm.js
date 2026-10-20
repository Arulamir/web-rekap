'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginForm({ verified }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [unverified, setUnverified] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login gagal.');
        setUnverified(!!data.unverified);
        return;
      }
      router.replace(data.role === 'admin' ? '/admin' : '/dashboard');
      router.refresh();
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    const res = await fetch('/api/auth/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      setInfo(data.message);
      setUnverified(false);
    } else setError(data.error);
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      {verified === '1' && <div className="alert success">Email berhasil diverifikasi. Silakan login.</div>}
      {verified === '0' && <div className="alert error">Link verifikasi tidak valid atau sudah kedaluwarsa.</div>}
      {error && <div className="alert error">{error}</div>}
      {info && <div className="alert success">{info}</div>}
      {unverified && (
        <button type="button" className="btn btn-ghost" onClick={resend}>Kirim ulang email verifikasi</button>
      )}

      <label className="field">
        <span>Email</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span>Password</span>
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <button className="btn btn-primary" disabled={loading}>{loading ? 'Memproses…' : 'Masuk'}</button>
      <p className="muted center">
        Belum punya akun? <Link href="/register">Daftar</Link>
      </p>
    </form>
  );
}
