import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ROLES, COMMISSION } from '@/lib/constants';
import { CommissionCrest } from '@/components/site-chrome';
import { logout } from '@/actions/auth';
import { FlashBanner } from '@/components/flash-banner';

const NAV = [
  { label: 'Dashboard', href: '/portal' },
  { label: 'My Profile', href: '/portal/profile' },
  { label: 'My Applications', href: '/portal/applications' },
  { label: 'My Documents', href: '/portal/documents' },
  { label: 'Notifications', href: '/portal/notifications' },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/portal');
  if (user.role !== ROLES.APPLICANT) redirect('/admin');

  const [unread, profile] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.applicantProfile.findUnique({
      where: { userId: user.id },
      select: { applicantRef: true, profileComplete: true, firstName: true, surname: true },
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="bg-kogi-700 text-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3">
          <Link href="/portal" className="flex items-center gap-3">
            <CommissionCrest size={40} />
            <span>
              <span className="block text-sm font-bold leading-tight">{COMMISSION.name}</span>
              <span className="block text-[11px] text-kogi-100">Applicant Portal</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="hidden text-right sm:block">
              <span className="block font-semibold leading-tight">
                {profile ? `${profile.firstName} ${profile.surname}` : user.fullName}
              </span>
              <span className="block font-mono text-[11px] text-kogi-100">{profile?.applicantRef}</span>
            </span>
            <Link href="/" className="text-kogi-50 hover:text-white hover:underline">Portal home</Link>
            <form action={logout}>
              <button type="submit" className="btn btn-sm border border-white/40 bg-white/10 text-white hover:bg-white/20">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav aria-label="Applicant navigation" className="border-b border-kogi-800 bg-kogi-800 text-white">
        <div className="container-page">
          <ul className="flex flex-wrap items-center gap-1 py-1 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded px-3 py-2 font-medium text-kogi-50 transition hover:bg-kogi-700 hover:text-white">
                  {item.label}
                  {item.href === '/portal/notifications' && unread > 0 ? (
                    <span className="ml-1.5 rounded-full bg-gold-400 px-1.5 py-0.5 text-[10px] font-bold text-gold-950">
                      {unread}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {!profile?.profileComplete ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="container-page py-2.5 text-sm text-amber-900">
            <strong>Your profile is incomplete.</strong> Complete your personal and contact details before
            applying.{' '}
            <Link href="/portal/profile" className="font-semibold underline">Complete profile now</Link>
          </div>
        </div>
      ) : null}

      <main className="container-page flex-1 py-8">
        <FlashBanner />
        {children}
      </main>

      <footer className="bg-kogi-900 py-4 text-center text-[11px] text-kogi-300">
        © {new Date().getFullYear()} {COMMISSION.name} · Your personal information is processed in
        accordance with the Nigeria Data Protection Act 2023
      </footer>
    </div>
  );
}
