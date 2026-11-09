import Link from 'next/link';
import { COMMISSION, ROLES } from '@/lib/constants';
import type { SessionUser } from '@/lib/auth';

const NAV: Array<{ label: string; href: string }> = [
  { label: 'Home', href: '/' },
  { label: 'The Commission', href: '/about' },
  { label: 'Leadership', href: '/leadership' },
  { label: 'Departments', href: '/departments' },
  { label: 'Ministries & Agencies', href: '/ministries' },
  { label: 'Recruitment', href: '/recruitment' },
  { label: 'News & Notices', href: '/news' },
  { label: 'Downloads', href: '/downloads' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Contact', href: '/contact' },
];

/**
 * The Commission's seal. Drawn rather than bitmapped so it stays crisp at
 * every size and prints cleanly on letters and admission slips.
 */
export function CommissionCrest({ size = 44, tone = 'dark' }: { size?: number; tone?: 'dark' | 'light' }) {
  const ring = tone === 'dark' ? '#cfa84f' : '#21503e';
  const field = tone === 'dark' ? '#16342a' : '#ffffff';
  const mark = tone === 'dark' ? '#eadcab' : '#21503e';
  const water = tone === 'dark' ? '#8fbda4' : '#3e7d61';
  return (
    <svg
      role="img"
      aria-label={`${COMMISSION.shortName} seal`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="shrink-0"
    >
      <circle cx="32" cy="32" r="31" fill={field} stroke={ring} strokeWidth="2.5" />
      <circle cx="32" cy="32" r="26.5" fill="none" stroke={ring} strokeWidth="1" opacity="0.55" />

      {/*
        The device: the Niger and the Benue meeting at Lokoja and running on as
        one river, over the beam of the scales under which appointments are made.
      */}
      <path
        d="M16 15c2.5 7.5 7 12.5 16 16.5"
        fill="none"
        stroke={water}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M48 15c-2.5 7.5-7 12.5-16 16.5"
        fill="none"
        stroke={water}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path d="M32 31.5v9" fill="none" stroke={mark} strokeWidth="3.6" strokeLinecap="round" />

      {/* The beam and pans of the scales. */}
      <path d="M18 43.5h28" fill="none" stroke={mark} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M22 43.5l-3.5 6h7z" fill={mark} />
      <path d="M42 43.5l-3.5 6h7z" fill={mark} />
      <path d="M32 46.5v4.5" fill="none" stroke={mark} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const portalHref = !user ? '/login' : user.role === ROLES.APPLICANT ? '/portal' : '/admin';
  const portalLabel = !user
    ? 'Applicant Login'
    : user.role === ROLES.APPLICANT
      ? 'My Dashboard'
      : 'Administration';

  return (
    <header className="sticky top-0 z-40">
      {/* Government bar */}
      <div className="bg-kogi-950 text-2xs text-kogi-100">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-1.5">
          <p className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-gold-400" />
            <span className="uppercase tracking-label">
              An official portal of the Government of {COMMISSION.state}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a href={`mailto:${COMMISSION.email}`} className="hover:text-white hover:underline">
              {COMMISSION.email}
            </a>
            <Link href="/track" className="font-semibold hover:text-white hover:underline">
              Track an application
            </Link>
          </div>
        </div>
      </div>

      {/* Masthead */}
      <div className="border-b-2 border-gold-500 bg-kogi-800 bg-kogi-weave bg-weave text-white">
        <div className="container-page flex items-center justify-between gap-6 py-3.5">
          <Link href="/" className="flex min-w-0 items-center gap-3.5 rounded-sm">
            <CommissionCrest size={46} />
            <span className="min-w-0">
              <span className="block font-serif text-base font-semibold leading-tight tracking-tight sm:text-[1.0625rem]">
                {COMMISSION.name}
              </span>
              <span className="mt-0.5 block text-2xs uppercase tracking-label text-gold-200">
                Civil Service Recruitment Management System
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/recruitment" className="btn-gold btn-sm hidden sm:inline-flex">
              Current vacancies
            </Link>
            <Link
              href={portalHref}
              className="btn btn-sm border-white/30 bg-white/10 text-white hover:border-white/60 hover:bg-white/20"
            >
              {portalLabel}
            </Link>
          </div>
        </div>
      </div>

      {/* Primary navigation */}
      <nav aria-label="Main navigation" className="border-b border-ink-200 bg-white shadow-raised">
        <div className="container-page">
          <ul className="flex flex-wrap items-stretch">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block border-b-2 border-transparent px-3 py-2.5 text-[0.8125rem] font-semibold text-ink-700 transition hover:border-kogi-600 hover:bg-kogi-50 hover:text-kogi-900"
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

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <h3 className="micro-label mb-3 text-gold-300">{title}</h3>
      <ul className="space-y-2 text-[0.8125rem]">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-kogi-100 transition hover:text-white hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-2 border-gold-500 bg-kogi-900 text-kogi-100">
      <div className="container-page grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <CommissionCrest size={40} />
            <p className="font-serif text-sm font-semibold leading-tight text-white">{COMMISSION.name}</p>
          </div>
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-kogi-200">{COMMISSION.address}</p>
          <dl className="mt-3 space-y-1 text-[0.8125rem]">
            <div className="flex gap-2">
              <dt className="text-kogi-300">Telephone</dt>
              <dd className="font-mono text-xs leading-5 text-kogi-100">{COMMISSION.phone}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-kogi-300">Email</dt>
              <dd className="break-all text-kogi-100">{COMMISSION.email}</dd>
            </div>
          </dl>
          <p className="mt-4 font-serif text-xs italic text-gold-200">“{COMMISSION.motto}”</p>
        </div>
        <FooterColumn
          title="The Commission"
          links={[
            { label: 'Profile and mandate', href: '/about' },
            { label: 'Functions and responsibilities', href: '/about#functions' },
            { label: 'Leadership', href: '/leadership' },
            { label: 'Departments and units', href: '/departments' },
            { label: 'Ministries and agencies', href: '/ministries' },
          ]}
        />
        <FooterColumn
          title="Recruitment"
          links={[
            { label: 'Current vacancies', href: '/recruitment' },
            { label: 'Create an applicant account', href: '/register' },
            { label: 'Applicant login', href: '/login' },
            { label: 'Track an application', href: '/track' },
            { label: 'The recruitment process', href: '/recruitment/process' },
          ]}
        />
        <FooterColumn
          title="Information"
          links={[
            { label: 'News and announcements', href: '/news' },
            { label: 'Circulars and public notices', href: '/notices' },
            { label: 'Forms and downloads', href: '/downloads' },
            { label: 'Frequently asked questions', href: '/faqs' },
            { label: 'Privacy notice', href: '/privacy' },
            { label: 'Contact and enquiries', href: '/contact' },
          ]}
        />
      </div>
      <div className="border-t border-kogi-800">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-4 text-2xs text-kogi-300">
          <p>
            © {new Date().getFullYear()} {COMMISSION.name}. All rights reserved.
          </p>
          <p>
            Developed and deployed by {COMMISSION.vendor} —{' '}
            <span className="text-kogi-200">{COMMISSION.vendorSite}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
