import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '../components/Header';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <>
      <Header session={session} active="dashboard" />
      <main className="container page">
        <DashboardClient userName={session.name} />
      </main>
    </>
  );
}
