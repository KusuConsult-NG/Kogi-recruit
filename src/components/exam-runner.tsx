'use client';

import { useEffect, useRef, useState } from 'react';
import { autoSubmitSitting, startSitting, submitSitting } from '@/actions/cbt';
import { ActionForm, SubmitButton } from '@/components/forms';

/** Begin a sitting. The clock starts when this is submitted. */
export function StartSittingForm({ sittingId, label }: { sittingId: string; label: string }) {
  return (
    <ActionForm
      action={startSitting}
      onSubmit={(e) => {
        if (
          !window.confirm(
            'Once you begin, the clock runs without stopping and the test submits itself when the time is up. Begin now?',
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {() => (
        <>
          <input type="hidden" name="sittingId" value={sittingId} />
          <SubmitButton className="btn-primary btn-lg" pendingLabel="Preparing your paper…">
            {label}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function SubmitSittingForm({
  sittingId,
  unanswered,
}: {
  sittingId: string;
  unanswered: number;
}) {
  return (
    <ActionForm
      action={submitSitting}
      onSubmit={(e) => {
        const warning =
          unanswered > 0
            ? `You have left ${unanswered} question(s) unanswered. Submit the test anyway? You cannot return to it.`
            : 'Submit your test? You cannot return to it.';
        if (!window.confirm(warning)) e.preventDefault();
      }}
    >
      {() => (
        <>
          <input type="hidden" name="sittingId" value={sittingId} />
          <SubmitButton className="btn-primary w-full" pendingLabel="Submitting…">
            Submit my test
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

function format(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/**
 * The countdown shown throughout a sitting. When the time runs out the form is
 * submitted automatically, which closes and marks the sitting on the server.
 * The server also checks expiry independently, so a tampered clock gains
 * nothing.
 */
export function SittingTimer({
  sittingId,
  expiresAtIso,
  totalSeconds,
}: {
  sittingId: string;
  expiresAtIso: string;
  totalSeconds: number;
}) {
  const expiresAt = new Date(expiresAtIso).getTime();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  );
  const submitted = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !submitted.current) {
        submitted.current = true;
        formRef.current?.requestSubmit();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  // Warn the candidate if they try to navigate away mid-test.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (remaining > 0) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [remaining]);

  const fraction = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const critical = remaining <= 60;
  const low = remaining <= 300;

  return (
    <div
      className={`rounded-md border px-4 py-3 ${
        critical
          ? 'border-[#9a2c20] bg-[#fcefed]'
          : low
            ? 'border-gold-400 bg-gold-50'
            : 'border-ink-200 bg-white'
      }`}
      aria-live="polite"
    >
      <p className="micro-label">Time remaining</p>
      <p
        className={`mt-1 font-mono text-3xl font-semibold leading-none ${
          critical ? 'text-[#9a2c20]' : low ? 'text-gold-800' : 'text-ink-950'
        }`}
        data-numeric
        role="timer"
      >
        {format(remaining)}
      </p>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-sm bg-ink-200">
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${
            critical ? 'bg-[#9a2c20]' : low ? 'bg-gold-500' : 'bg-kogi-600'
          }`}
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
      {critical ? (
        <p className="mt-2 text-xs font-semibold text-[#9a2c20]">
          Less than a minute left. Your test will submit itself.
        </p>
      ) : low ? (
        <p className="mt-2 text-xs font-medium text-gold-800">
          Five minutes or less remaining.
        </p>
      ) : null}

      {/* Submitted automatically when the clock reaches zero. */}
      <form ref={formRef} action={autoSubmitSitting} className="hidden">
        <input type="hidden" name="sittingId" value={sittingId} />
      </form>
    </div>
  );
}
