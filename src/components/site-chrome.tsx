import Link from 'next/link';
import { COMMISSION } from '@/lib/constants';
import type { SessionUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'The Commission', href: '/about' },
  { label: 'Leadership', href: '/leadership' },
  { label: 'Departments', href: '/departments' },
  { label: 'Recruitment', href: '/recruitment' },
  { label: 'News & Notices', href: '/news' },
  { label: 'Downloads', href: '/downloads' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Contact', href: '/contact' },
];

export function CommissionCrest({ size = 44 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-gold-400 bg-kogi-800 font-bold text-gold-300"
      style={{ width: size, height: size, fontSize: size * 0.3 }}
    >
      KSC
    </span>
  );
}

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const portalHref = !user
    ? '/login'
    : user.role === ROLES.APPLICANT
      ? '/portal'
      : '/admin';
  const portalLabel = !user ? 'Applicant Login' : user.role === ROLES.APPLICANT ? 'My Dashboard' : 'Administration';

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      <div className="bg-kogi-900 text-xs text-kogi-100">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-1.5">
          <p>Government of {COMMISSION.state} — Official Portal</p>
          <div className="flex flex-wrap items-center gap-4">
            <a href={`mailto:${COMMISSION.email}`} className="hover:text-white hover:underline">
              {COMMISSION.email}
            </a>
            <Link href="/track" className="hover:text-white hover:underline">
              Track Application
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-kogi-700 text-white">
        <div className="container-page flex items-center justify-between gap-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <CommissionCrest />
            <span>
              <span className="block text-sm font-bold leading-tight sm:text-base">
                {COMMISSION.name}
              </span>
              <span className="block text-[11px] leading-tight text-kogi-100">
                Civil Service Recruitment Management System
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/recruitment" className="btn-gold btn-sm hidden sm:inline-flex">
              Current Vacancies
            </Link>
            <Link
              href={portalHref}
              className="btn btn-sm border border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              {portalLabel}
            </Link>
          </div>
        </div>
      </div>

      <nav aria-label="Main navigation" className="border-b border-kogi-800 bg-kogi-800 text-white">
        <div className="container-page">
          <ul className="flex flex-wrap items-center gap-x-1 gap-y-0.5 py-1 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded px-3 py-2 font-medium text-kogi-50 transition hover:bg-kogi-700 hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-14 bg-kogi-900 text-kogi-100">
      <div className="container-page grid grid-cols-1 gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <CommissionCrest size={38} />
            <p className="text-sm font-bold text-white">{COMMISSION.name}</p>
          </div>
          <p className="mt-3 text-xs leading-relaxed">{COMMISSION.address}</p>
          <p className="mt-2 text-xs">{COMMISSION.phone}</p>
          <p className="text-xs">{COMMISSION.email}</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">The Commission</h3>
          <ul className="space-y-1.5 text-xs">
            <li><Link href="/about" className="hover:text-white hover:underline">Profile and Mandate</Link></li>
            <li><Link href="/about#functions" className="hover:text-white hover:underline">Functions and Responsibilities</Link></li>
            <li><Link href="/leadership" className="hover:text-white hover:underline">Leadership</Link></li>
            <li><Link href="/departments" className="hover:text-white hover:underline">Departments and Units</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Recruitment</h3>
          <ul className="space-y-1.5 text-xs">
            <li><Link href="/recruitment" className="hover:text-white hover:underline">Current Vacancies</Link></li>
            <li><Link href="/register" className="hover:text-white hover:underline">Create an Applicant Account</Link></li>
            <li><Link href="/login" className="hover:text-white hover:underline">Applicant Login</Link></li>
            <li><Link href="/track" className="hover:text-white hover:underline">Track an Application</Link></li>
            <li><Link href="/recruitment/process" className="hover:text-white hover:underline">Recruitment Process</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Information</h3>
          <ul className="space-y-1.5 text-xs">
            <li><Link href="/news" className="hover:text-white hover:underline">News and Announcements</Link></li>
            <li><Link href="/notices" className="hover:text-white hover:underline">Circulars and Public Notices</Link></li>
            <li><Link href="/downloads" className="hover:text-white hover:underline">Forms and Downloads</Link></li>
            <li><Link href="/faqs" className="hover:text-white hover:underline">Frequently Asked Questions</Link></li>
            <li><Link href="/privacy" className="hover:text-white hover:underline">Privacy Notice</Link></li>
            <li><Link href="/contact" className="hover:text-white hover:underline">Contact and Enquiries</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-kogi-800 py-4">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 text-[11px] text-kogi-300">
          <p>© {new Date().getFullYear()} {COMMISSION.name}. All rights reserved.</p>
          <p>
            Developed and deployed by {COMMISSION.vendor} —{' '}
            <span className="text-kogi-200">{COMMISSION.vendorSite}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
