import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '../components/Header';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/dashboard');
  return (
    <>
      <Header session={session} active="admin" />
      <main className="container page">
        <AdminClient />
      </main>
    </>
  );
}
