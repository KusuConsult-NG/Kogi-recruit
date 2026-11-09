import Link from 'next/link';
import { CommissionCrest } from '@/components/site-chrome';
import { COMMISSION } from '@/lib/constants';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-100">
      <header className="border-b-2 border-gold-500 bg-kogi-800 bg-kogi-weave bg-weave text-white">
        <div className="container-page flex items-center justify-between gap-4 py-3.5">
          <Link href="/" className="flex items-center gap-3.5">
            <CommissionCrest size={44} />
            <span>
              <span className="block font-serif text-base font-semibold leading-tight">{COMMISSION.name}</span>
              <span className="mt-0.5 block text-2xs uppercase tracking-label text-gold-200">
                Civil Service Recruitment Management System
              </span>
            </span>
          </Link>
          <Link href="/" className="text-[0.8125rem] font-medium text-kogi-100 hover:text-white hover:underline">
            ← Back to the portal
          </Link>
        </div>
      </header>

      <main id="main-content" className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-xl">{children}</div>
      </main>

      <footer className="border-t border-ink-200 bg-white py-4">
        <p className="container-page text-center text-2xs text-ink-500">
          © {new Date().getFullYear()} {COMMISSION.name} · This is a secure government service.
          Activity on this portal is logged. Developed by {COMMISSION.vendor}.
        </p>
      </footer>
    </div>
  );
}
