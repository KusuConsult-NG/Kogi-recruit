import Link from 'next/link';
import { CommissionCrest } from '@/components/site-chrome';
import { COMMISSION } from '@/lib/constants';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="bg-kogi-700 text-white">
        <div className="container-page flex items-center justify-between gap-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <CommissionCrest size={40} />
            <span>
              <span className="block text-sm font-bold leading-tight">{COMMISSION.name}</span>
              <span className="block text-[11px] text-kogi-100">
                Civil Service Recruitment Management System
              </span>
            </span>
          </Link>
          <Link href="/" className="text-sm text-kogi-50 hover:text-white hover:underline">
            ← Back to portal
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl">{children}</div>
      </main>
      <footer className="bg-kogi-900 py-3 text-center text-[11px] text-kogi-300">
        © {new Date().getFullYear()} {COMMISSION.name} · Developed by {COMMISSION.vendor}
      </footer>
    </div>
  );
}
