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

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="sticky top-0 z-30 bg-kogi-900 text-white shadow">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/admin" className="flex items-center gap-3">
            <CommissionCrest size={36} />
            <span>
              <span className="block text-sm font-bold leading-tight">{COMMISSION.shortName} Administration</span>
              <span className="block text-[10px] text-kogi-300">
                Civil Service Recruitment Management System
              </span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="hidden text-right sm:block">
              <span className="block text-xs font-semibold leading-tight">{user.fullName}</span>
              <span className="block text-[10px] text-kogi-300">{ROLE_LABELS[user.role as Role]}</span>
            </span>
            <Link href="/" className="text-xs text-kogi-200 hover:text-white hover:underline">
              Public portal
            </Link>
            <Link href="/change-password" className="text-xs text-kogi-200 hover:text-white hover:underline">
              Password
            </Link>
            <form action={logout}>
              <button type="submit" className="btn btn-sm border border-white/30 bg-white/10 text-white hover:bg-white/20">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="w-full shrink-0 bg-kogi-900 px-2 py-4 lg:w-60 lg:min-h-[calc(100vh-57px)]">
          <AdminSidebar user={user} />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <FlashBanner />
          {children}
        </main>
      </div>

      <footer className="bg-kogi-950 px-4 py-3 text-center text-[11px] text-kogi-400">
        {COMMISSION.name} — restricted administrative area. All activity is logged in the system audit
        trail. Developed by {COMMISSION.vendor}.
      </footer>
    </div>
  );
}
