'use client';

import Link from 'next/link';

/** Friendly presentation for authentication, authorisation and unexpected errors. */
export function ErrorScreen({
  error,
  reset,
  homeHref = '/',
  homeLabel = 'Return to the portal home',
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  const message = error.message ?? '';
  const isAuth = /Authentication required/i.test(message);
  const isForbidden = /Missing permission|access required|not authorised/i.test(message);

  const title = isAuth
    ? 'Please sign in'
    : isForbidden
      ? 'You are not authorised to view this page'
      : 'Something went wrong';

  const detail = isAuth
    ? 'Your session has expired or you are not signed in. Sign in again to continue.'
    : isForbidden
      ? 'Your role does not include this function. If you believe you need access, contact the Commission Administrator — roles and permissions are managed centrally.'
      : 'The portal could not complete your request. The problem has been logged. Try again, and contact the system administrator if it continues.';

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="max-w-lg">
        <h1 className="text-xl font-bold text-ink-950">{title}</h1>
        <p className="mt-2 text-sm text-ink-600">{detail}</p>
        {!isAuth && !isForbidden && message ? (
          <p className="mt-3 rounded border border-ink-200 bg-ink-50 px-3 py-2 text-left font-mono text-xs text-ink-600">
            {message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {isAuth ? (
            <Link href="/login" className="btn-primary">Sign in</Link>
          ) : reset ? (
            <button type="button" onClick={reset} className="btn-primary">Try again</button>
          ) : null}
          <Link href={homeHref} className="btn-secondary">{homeLabel}</Link>
        </div>
      </div>
    </div>
  );
}
