'use client';

import { trackApplication } from '@/actions/public';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field, StatusBadge, ProgressBar, DescriptionList } from '@/components/ui';
import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';

interface TrackData {
  reference: string;
  applicantName: string;
  exerciseTitle: string;
  exerciseReference: string;
  position: string;
  status: string;
  stage: string;
  completeness: number;
  submittedAt: string | null;
  documentsTotal: number;
  documentsVerified: number;
  documentsRejected: number;
  shortlisted: boolean;
  examNumber: string | null;
  examTitle: string | null;
  examDate: string | null;
  examTime: string | null;
  examCentre: string | null;
  examScore: number | null;
  interviewTitle: string | null;
  interviewDate: string | null;
  interviewTime: string | null;
  interviewVenue: string | null;
  history: Array<{ toStatus: string; remarks: string | null; createdAt: string }>;
}

export function TrackForm() {
  return (
    <ActionForm action={trackApplication}>
      {(state) => {
        const data = state.ok ? (state.data as unknown as TrackData) : null;
        return (
          <>
            {!data ? (
              <>
                <Field label="Application reference" name="reference" required
                  hint="For example KGCSC/2026/REC001/A1B2C3">
                  <input id="reference" name="reference" required defaultValue={state.values?.reference ?? ''} className="input" />
                </Field>
                <Field label="Surname" name="surname" required>
                  <input id="surname" name="surname" required defaultValue={state.values?.surname ?? ''} className="input" />
                </Field>
                <SubmitButton className="btn-primary" pendingLabel="Searching…">Track application</SubmitButton>
              </>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-kogi-50 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-kogi-700">Application reference</p>
                    <p className="font-mono text-sm font-semibold text-kogi-900">{data.reference}</p>
                  </div>
                  <StatusBadge status={data.status} label={APPLICATION_STATUS_LABELS[data.status] ?? data.status} />
                </div>

                <DescriptionList
                  items={[
                    { label: 'Applicant', value: data.applicantName },
                    { label: 'Recruitment exercise', value: `${data.exerciseTitle} (${data.exerciseReference})` },
                    { label: 'Position applied for', value: data.position },
                    { label: 'Current stage', value: data.stage.replace(/_/g, ' ').toLowerCase() },
                    { label: 'Date submitted', value: formatDateTime(data.submittedAt) },
                    {
                      label: 'Documents',
                      value: `${data.documentsVerified} verified of ${data.documentsTotal}${data.documentsRejected > 0 ? ` · ${data.documentsRejected} need correction` : ''}`,
                    },
                  ]}
                />

                <ProgressBar value={data.completeness} label="Application completeness" />

                {data.examNumber ? (
                  <div className="rounded-md border border-[#bcd4e4] bg-[#eef5fa] px-4 py-3">
                    <p className="text-sm font-semibold text-[#164765]">Examination</p>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#164765]">
                      <div><dt className="opacity-70">Examination number</dt><dd className="font-mono font-semibold">{data.examNumber}</dd></div>
                      <div><dt className="opacity-70">Date</dt><dd className="font-semibold">{formatDate(data.examDate)} {data.examTime}</dd></div>
                      <div><dt className="opacity-70">Centre</dt><dd className="font-semibold">{data.examCentre ?? 'To be advised'}</dd></div>
                      {data.examScore !== null ? (
                        <div><dt className="opacity-70">Score</dt><dd className="font-semibold">{data.examScore}</dd></div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}

                {data.interviewDate ? (
                  <div className="rounded-md border border-[#cfc6de] bg-[#f4f1f9] px-4 py-3">
                    <p className="text-sm font-semibold text-[#3a3053]">Interview</p>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#3a3053]">
                      <div><dt className="opacity-70">Date</dt><dd className="font-semibold">{formatDate(data.interviewDate)}</dd></div>
                      <div><dt className="opacity-70">Time</dt><dd className="font-semibold">{data.interviewTime ?? 'To be advised'}</dd></div>
                      <div className="col-span-2"><dt className="opacity-70">Venue</dt><dd className="font-semibold">{data.interviewVenue}</dd></div>
                    </dl>
                  </div>
                ) : null}

                {data.history.length > 0 ? (
                  <div>
                    <p className="mb-2 text-sm font-semibold text-ink-950">Application history</p>
                    <ol className="space-y-2 border-l-2 border-ink-200 pl-4">
                      {data.history.map((h, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-kogi-600" />
                          <p className="text-sm font-medium text-ink-800">
                            {APPLICATION_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                          </p>
                          <p className="text-xs text-ink-500">{formatDateTime(h.createdAt)}</p>
                          {h.remarks ? <p className="mt-0.5 text-xs text-ink-600">{h.remarks}</p> : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                <p className="border-t border-ink-200 pt-3 text-xs text-ink-500">
                  This summary is provided for the applicant named above. Full details, documents and
                  notifications are available after signing in.
                </p>
              </div>
            )}
          </>
        );
      }}
    </ActionForm>
  );
}
