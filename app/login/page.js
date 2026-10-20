import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }) {
  if (await getSession()) redirect('/');
  const { verified } = await searchParams;
  return (
    <main className="auth-wrap">
      <div className="card auth-card">
        <div className="auth-head">
          <span className="brand-mark lg">R</span>
          <h1>Rekap Reimburse</h1>
          <p className="muted">Masuk untuk mencatat reimburse</p>
        </div>
        <LoginForm verified={verified ?? null} />
      </div>
    </main>
  );
}
