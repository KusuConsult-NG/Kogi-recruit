import Link from 'next/link';
import { COMMISSION } from '@/lib/constants';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 text-center">
      <p className="text-5xl font-bold text-kogi-700">404</p>
      <h1 className="mt-3 text-xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        The page you requested does not exist, has been moved, or is no longer published on the{' '}
        {COMMISSION.name} portal.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">Return to the portal home</Link>
        <Link href="/recruitment" className="btn-secondary">Current vacancies</Link>
        <Link href="/contact" className="btn-ghost">Contact the Commission</Link>
      </div>
    </div>
  );
}
