'use client';

import { ErrorScreen } from '@/components/error-screen';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-ink-100 py-16">
      <ErrorScreen error={error} reset={reset} />
    </div>
  );
}
