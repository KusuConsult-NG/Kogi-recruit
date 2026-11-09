import Link from 'next/link';
import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * The Commission's shared interface components.
 *
 * Everything here is styled through the design system in globals.css, so a
 * change to a token or a component class carries across every page.
 * ------------------------------------------------------------------------- */

export function Card({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`card ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="card-header">
      <div className="min-w-0">
        {eyebrow ? <p className="micro-label mb-0.5">{eyebrow}</p> : null}
        <h2 className="card-title">{title}</h2>
        {description ? <p className="mt-0.5 text-[0.8125rem] text-ink-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card-footer ${className}`}>{children}</div>;
}

/** A labelled rule used to separate groups of fields or records. */
export function SectionRule({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="micro-label whitespace-nowrap">{label}</span>
      <span className="h-px flex-1 bg-ink-200" aria-hidden />
      {children}
    </div>
  );
}

export function PageHeading({
  title,
  description,
  actions,
  breadcrumb,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-2.5 text-xs text-ink-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            {breadcrumb.map((item, i) => (
              <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden className="text-ink-400">›</span> : null}
                {item.href ? (
                  <Link href={item.href} className="hover:text-kogi-700 hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span className="font-medium text-ink-700">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-ink-200 pb-4">
        <div className="min-w-0">
          {eyebrow ? (
            <>
              <span aria-hidden className="mb-2.5 block h-0.5 w-10 bg-gold-500" />
              <p className="micro-label mb-1.5 text-gold-700">{eyebrow}</p>
            </>
          ) : null}
          <h1 className="font-serif text-[1.5rem] font-semibold leading-tight tracking-tight text-ink-950 sm:text-[1.75rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-measure text-sm leading-relaxed text-ink-600">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children?: ReactNode;
}) {
  const tones = {
    info: 'border-[#bcd4e4] bg-[#eef5fa] text-[#164765] before:bg-[#1f5b86]',
    success: 'border-kogi-300 bg-kogi-50 text-kogi-900 before:bg-kogi-600',
    warning: 'border-gold-300 bg-gold-50 text-gold-900 before:bg-gold-500',
    error: 'border-[#e7c3bd] bg-[#fcefed] text-[#7d2219] before:bg-[#9a2c20]',
  } as const;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`relative overflow-hidden rounded-sm border px-4 py-3 pl-5 text-sm before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[''] ${tones[tone]}`}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1 leading-relaxed' : 'leading-relaxed'}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-ink-300 bg-ink-50/60 px-6 py-12 text-center">
      <span aria-hidden className="mb-3 h-8 w-8 rounded-full border border-ink-300 bg-white shadow-hairline" />
      <p className="font-serif text-base font-semibold text-ink-800">{title}</p>
      {description ? <p className="mt-1 max-w-measure text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'green' | 'amber' | 'red' | 'blue';
  href?: string;
}) {
  const accents = {
    default: 'before:bg-ink-300',
    green: 'before:bg-kogi-600',
    amber: 'before:bg-gold-500',
    red: 'before:bg-[#9a2c20]',
    blue: 'before:bg-[#1f5b86]',
  } as const;
  const inner = (
    <>
      <p className="micro-label">{label}</p>
      <p className="mt-2 font-serif text-[1.75rem] font-semibold leading-none text-ink-950" data-numeric>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-snug text-ink-500">{hint}</p> : null}
    </>
  );
  const className = `relative overflow-hidden rounded-md border border-ink-200 bg-white px-4 py-3.5 pl-5 shadow-raised before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[''] ${accents[tone]} ${
    href ? 'transition hover:border-kogi-400 hover:shadow-panel' : ''
  }`;
  return href ? (
    <Link href={href} className={`block ${className}`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

const STATUS_TONES: Record<string, string> = {
  DRAFT: 'badge-slate',
  PENDING_APPROVAL: 'badge-amber',
  APPROVED: 'badge-blue',
  PUBLISHED: 'badge-green',
  SUSPENDED: 'badge-amber',
  CLOSED: 'badge-slate',
  ARCHIVED: 'badge-slate',
  REJECTED: 'badge-red',
  RETIRED: 'badge-slate',
  SUBMITTED: 'badge-blue',
  UNDER_SCREENING: 'badge-amber',
  INCOMPLETE: 'badge-amber',
  RESUBMISSION_REQUIRED: 'badge-amber',
  QUALIFIED: 'badge-green',
  DISQUALIFIED: 'badge-red',
  SHORTLISTED: 'badge-green',
  EXAM_SCHEDULED: 'badge-blue',
  EXAM_COMPLETED: 'badge-blue',
  INTERVIEW_SCHEDULED: 'badge-purple',
  INTERVIEW_COMPLETED: 'badge-purple',
  SELECTED: 'badge-green',
  NOT_SELECTED: 'badge-red',
  WITHDRAWN: 'badge-slate',
  PENDING: 'badge-amber',
  VERIFIED: 'badge-green',
  PRESENT: 'badge-green',
  ABSENT: 'badge-red',
  PASS: 'badge-green',
  FAIL: 'badge-red',
  SENT: 'badge-green',
  QUEUED: 'badge-amber',
  FAILED: 'badge-red',
  READ: 'badge-slate',
  OPEN: 'badge-amber',
  IN_PROGRESS: 'badge-blue',
  RESPONDED: 'badge-green',
  NEW: 'badge-amber',
  DONE: 'badge-green',
  CANCELLED: 'badge-slate',
  SCHEDULED: 'badge-blue',
  ONGOING: 'badge-amber',
  COMPLETED: 'badge-green',
  RESERVE: 'badge-amber',
  URGENT: 'badge-red',
  HIGH: 'badge-amber',
  NORMAL: 'badge-slate',
  LOW: 'badge-slate',
  CONFIDENTIAL: 'badge-red',
  RESTRICTED: 'badge-amber',
  GENERAL: 'badge-slate',
  // Computer-based testing
  NOT_STARTED: 'badge-slate',
  EXPIRED: 'badge-amber',
  EASY: 'badge-green',
  MEDIUM: 'badge-blue',
  HARD: 'badge-amber',
  CBT: 'badge-blue',
  CENTRE: 'badge-slate',
  HYBRID: 'badge-purple',
  // Establishment
  MINISTRY: 'badge-green',
  EXTRA_MINISTERIAL: 'badge-blue',
  AGENCY: 'badge-blue',
  PARASTATAL: 'badge-purple',
  BOARD: 'badge-slate',
  COMMISSION: 'badge-green',
};

/** A code rendered as readable prose: EXAM_SCHEDULED → "Exam scheduled". */
export function readable(status: string): string {
  const words = status.replace(/_/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONES[status] ?? 'badge-slate';
  return <span className={tone}>{label ?? readable(status)}</span>;
}

export function ProgressBar({
  value,
  label,
  tone = 'green',
}: {
  value: number;
  label?: string;
  tone?: 'green' | 'amber' | 'blue';
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const tones = { green: 'bg-kogi-600', amber: 'bg-gold-500', blue: 'bg-[#1f5b86]' } as const;
  return (
    <div>
      {label ? (
        <div className="mb-1 flex items-center justify-between text-xs text-ink-600">
          <span>{label}</span>
          <span className="font-semibold" data-numeric>{clamped}%</span>
        </div>
      ) : null}
      <div
        className="h-1.5 w-full overflow-hidden rounded-sm bg-ink-200"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full ${tones[tone]}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  name?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
        {required ? (
          <span className="ml-1 text-2xs font-bold uppercase tracking-label text-[#9a2c20]">required</span>
        ) : null}
      </label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}

export function DescriptionList({
  items,
  columns = 2,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  columns?: 1 | 2 | 3;
}) {
  const cols = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' } as const;
  return (
    <dl className={`grid grid-cols-1 gap-x-8 gap-y-3.5 ${cols[columns]}`}>
      {items.map((item) => (
        <div key={item.label} className="border-b border-ink-150 pb-2.5 last:border-0">
          <dt className="micro-label">{item.label}</dt>
          <dd className="mt-1 text-sm text-ink-900">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pagination({
  page,
  pageCount,
  basePath,
  params = {},
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;
  const build = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set('page', String(p));
    return `${basePath}?${sp.toString()}`;
  };
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 2,
  );
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 bg-ink-50/70 px-5 py-3 text-sm">
      <p className="micro-label">
        Page {page} of {pageCount}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {page > 1 ? (
          <Link href={build(page - 1)} className="btn-secondary btn-sm">
            Previous
          </Link>
        ) : null}
        {pages.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - pages[i - 1] > 1 ? <span className="px-1 text-ink-400">…</span> : null}
            <Link
              href={build(p)}
              className={p === page ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Link>
          </span>
        ))}
        {page < pageCount ? (
          <Link href={build(page + 1)} className="btn-secondary btn-sm">
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function Tabs({
  tabs,
  active,
}: {
  tabs: Array<{ label: string; href: string; count?: number }>;
  active: string;
}) {
  return (
    <div className="mb-5 border-b border-ink-200">
      <nav className="-mb-px flex flex-wrap gap-0.5" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.href === active;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[0.8125rem] font-semibold transition ${
                isActive
                  ? 'border-kogi-700 text-kogi-900'
                  : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-950'
              }`}
            >
              {tab.label}
              {typeof tab.count === 'number' ? (
                <span
                  className={`ml-1.5 rounded-sm px-1.5 py-0.5 text-2xs font-bold ${
                    isActive ? 'bg-kogi-100 text-kogi-800' : 'bg-ink-150 text-ink-600'
                  }`}
                  data-numeric
                >
                  {tab.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** A compact toolbar for filters above a table. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-ink-200 bg-white px-4 py-3 shadow-raised">
      {children}
    </div>
  );
}

/** A reference number or code, set in the monospace face. */
export function Ref({ children }: { children: ReactNode }) {
  return <span className="ref">{children}</span>;
}
