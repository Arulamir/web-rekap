import Link from 'next/link';

export default function Header({ session, active }) {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">R</span> Rekap Reimburse
        </Link>
        <nav className="nav">
          <Link href="/dashboard" className={active === 'dashboard' ? 'active' : ''}>Input</Link>
          {session.role === 'admin' && (
            <Link href="/admin" className={active === 'admin' ? 'active' : ''}>Rekap Admin</Link>
          )}
          <span className="who" title={session.email}>{session.name}</span>
          <form action="/api/auth/logout" method="post">
            <button className="btn btn-ghost btn-sm">Keluar</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
