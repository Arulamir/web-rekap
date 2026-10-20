import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import RegisterForm from './RegisterForm';

export default async function RegisterPage() {
  if (await getSession()) redirect('/');
  return (
    <main className="auth-wrap">
      <div className="card auth-card">
        <div className="auth-head">
          <span className="brand-mark lg">R</span>
          <h1>Daftar Akun</h1>
          <p className="muted">Nama Anda akan tercatat di setiap rekap reimburse</p>
        </div>
        <RegisterForm />
      </div>
    </main>
  );
}
