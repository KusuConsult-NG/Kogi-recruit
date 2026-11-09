import Link from 'next/link';
import type { ReactNode } from 'react';

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
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="card-header">
      <div>
        <h2 className="card-title">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

export function PageHeading({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="mb-6">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-2 text-xs text-slate-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            {breadcrumb.map((item, i) => (
              <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden>/</span> : null}
                {item.href ? (
                  <Link href={item.href} className="hover:text-kogi-700 hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-slate-700">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p> : null}
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
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-kogi-200 bg-kogi-50 text-kogi-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
  } as const;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-4 py-3 text-sm ${tones[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
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
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
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
  const tones = {
    default: 'border-slate-200',
    green: 'border-kogi-300 bg-kogi-50/50',
    amber: 'border-amber-300 bg-amber-50/50',
    red: 'border-red-300 bg-red-50/50',
    blue: 'border-sky-300 bg-sky-50/50',
  } as const;
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </>
  );
  const className = `rounded-lg border bg-white px-4 py-3.5 shadow-sm ${tones[tone]} ${href ? 'transition hover:shadow-md' : ''}`;
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
  NOT_SELECTED_: 'badge-red',
  URGENT: 'badge-red',
  HIGH: 'badge-amber',
  NORMAL: 'badge-slate',
  LOW: 'badge-slate',
  CONFIDENTIAL: 'badge-red',
  RESTRICTED: 'badge-amber',
  GENERAL: 'badge-slate',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONES[status] ?? 'badge-slate';
  return <span className={tone}>{label ?? status.replace(/_/g, ' ').toLowerCase()}</span>;
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
  const tones = { green: 'bg-kogi-600', amber: 'bg-amber-500', blue: 'bg-sky-600' } as const;
  return (
    <div>
      {label ? (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
          <span>{label}</span>
          <span className="font-semibold">{clamped}%</span>
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${clamped}%` }} />
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
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
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
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-3 ${cols[columns]}`}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-slate-800">{item.value ?? '—'}</dd>
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
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm">
      <p className="text-xs text-slate-500">
        Page {page} of {pageCount}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {page > 1 ? (
          <Link href={build(page - 1)} className="btn-ghost btn-sm">
            Previous
          </Link>
        ) : null}
        {pages.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - pages[i - 1] > 1 ? <span className="px-1 text-slate-400">…</span> : null}
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
          <Link href={build(page + 1)} className="btn-ghost btn-sm">
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
    <div className="mb-5 border-b border-slate-200">
      <nav className="-mb-px flex flex-wrap gap-1" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.href === active;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'border-kogi-700 text-kogi-800'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {tab.label}
              {typeof tab.count === 'number' ? (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
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
