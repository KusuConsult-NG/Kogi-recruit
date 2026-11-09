import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { COMMISSION, ROLES, ROLE_LABELS, type Role } from '@/lib/constants';
import { CommissionCrest } from '@/components/site-chrome';
import { AdminSidebar } from '@/components/admin-nav';
import { logout } from '@/actions/auth';
import { FlashBanner } from '@/components/flash-banner';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role === ROLES.APPLICANT) redirect('/portal');

  const mustChange = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mustChangePassword: true },
  });
  if (mustChange?.mustChangePassword) redirect('/change-password');

  const initials = user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className="flex min-h-screen flex-col bg-ink-100">
      <header className="sticky top-0 z-30 border-b-2 border-gold-500 bg-kogi-900 text-white shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <Link href="/admin" className="flex items-center gap-3">
            <CommissionCrest size={38} />
            <span>
              <span className="block font-serif text-sm font-semibold leading-tight">
                {COMMISSION.shortName} · Administration
              </span>
              <span className="mt-0.5 block text-2xs uppercase tracking-label text-gold-200">
                Civil Service Recruitment Management System
              </span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-4">
            <nav aria-label="Account" className="flex items-center gap-4 text-xs">
              <Link href="/" className="text-kogi-200 transition hover:text-white hover:underline">
                Public portal
              </Link>
              <Link href="/change-password" className="text-kogi-200 transition hover:text-white hover:underline">
                Change password
              </Link>
            </nav>
            <div className="flex items-center gap-2.5 border-l border-kogi-700 pl-4">
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-full border border-gold-400/70 bg-kogi-800 font-serif text-xs font-semibold text-gold-200"
              >
                {initials}
              </span>
              <span className="hidden sm:block">
                <span className="block text-xs font-semibold leading-tight">{user.fullName}</span>
                <span className="block text-2xs text-kogi-300">{ROLE_LABELS[user.role as Role]}</span>
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="btn btn-sm border-white/25 bg-white/10 text-white hover:border-white/60 hover:bg-white/20"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-r border-kogi-950/40 bg-kogi-900 px-2 py-5 lg:w-64 lg:min-h-[calc(100vh-57px)]">
          <AdminSidebar user={user} />
        </aside>
        <main id="main-content" className="min-w-0 flex-1 px-4 py-7 sm:px-6 lg:px-9">
          <FlashBanner />
          {children}
        </main>
      </div>

      <footer className="border-t border-kogi-950 bg-kogi-950 px-4 py-3">
        <p className="text-center text-2xs leading-relaxed text-kogi-400">
          {COMMISSION.name} — restricted administrative area. Every action is written to the system
          audit trail. Developed by {COMMISSION.vendor}.
        </p>
      </footer>
    </div>
  );
}
