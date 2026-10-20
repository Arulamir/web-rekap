'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function RegisterForm() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Konfirmasi password tidak sama.');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Pendaftaran gagal.');
      setDone(data.message);
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="stack">
        <div className="alert success">{done}</div>
        <p className="muted center">Setelah verifikasi, silakan <Link href="/login">login</Link>.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      {error && <div className="alert error">{error}</div>}
      <label className="field">
        <span>Nama lengkap</span>
        <input required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={set('name')} />
      </label>
      <label className="field">
        <span>Email</span>
        <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
      </label>
      <label className="field">
        <span>Password</span>
        <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
        <small className="muted">Minimal 8 karakter</small>
      </label>
      <label className="field">
        <span>Konfirmasi password</span>
        <input type="password" required minLength={8} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
      </label>
      <button className="btn btn-primary" disabled={loading}>{loading ? 'Mengirim…' : 'Daftar'}</button>
      <p className="muted center">
        Sudah punya akun? <Link href="/login">Masuk</Link>
      </p>
    </form>
  );
}
