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
  { label: 'Tests & Examinations', href: '/portal/tests' },
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
    <div className="flex min-h-screen flex-col bg-ink-100">
      <header className="border-b-2 border-gold-500 bg-kogi-800 bg-kogi-weave bg-weave text-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3.5">
          <Link href="/portal" className="flex items-center gap-3.5">
            <CommissionCrest size={44} />
            <span>
              <span className="block font-serif text-base font-semibold leading-tight">{COMMISSION.name}</span>
              <span className="mt-0.5 block text-2xs uppercase tracking-label text-gold-200">
                Applicant Portal
              </span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="hidden text-right sm:block">
              <span className="block text-[0.8125rem] font-semibold leading-tight">
                {profile ? `${profile.firstName} ${profile.surname}` : user.fullName}
              </span>
              <span className="block font-mono text-2xs text-gold-200">{profile?.applicantRef}</span>
            </span>
            <Link href="/" className="text-[0.8125rem] text-kogi-100 hover:text-white hover:underline">
              Portal home
            </Link>
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
      </header>

      <nav aria-label="Applicant navigation" className="border-b border-ink-200 bg-white shadow-raised">
        <div className="container-page">
          <ul className="flex flex-wrap items-stretch">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-[0.8125rem] font-semibold text-ink-700 transition hover:border-kogi-600 hover:bg-kogi-50 hover:text-kogi-900"
                >
                  {item.label}
                  {item.href === '/portal/notifications' && unread > 0 ? (
                    <span className="rounded-sm bg-gold-300 px-1.5 py-0.5 text-2xs font-bold text-gold-950" data-numeric>
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
        <div className="border-b border-gold-300 bg-gold-50">
          <div className="container-page py-2.5 text-[0.8125rem] text-gold-900">
            <strong className="font-semibold">Your profile is incomplete.</strong> Complete your personal
            and contact details before applying.{' '}
            <Link href="/portal/profile" className="font-semibold underline underline-offset-2">
              Complete profile now
            </Link>
          </div>
        </div>
      ) : null}

      <main id="main-content" className="container-page flex-1 py-8">
        <FlashBanner />
        {children}
      </main>

      <footer className="mt-10 border-t-2 border-gold-500 bg-kogi-900 py-5">
        <p className="container-page text-center text-2xs leading-relaxed text-kogi-300">
          © {new Date().getFullYear()} {COMMISSION.name} · Your personal information is processed in
          accordance with the Nigeria Data Protection Act 2023.
        </p>
      </footer>
    </div>
  );
}
