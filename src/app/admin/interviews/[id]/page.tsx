import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageAnyPermission } from '@/lib/page-guards';
import { hasAnyPermission, hasPermission, PERMISSIONS } from '@/lib/rbac';
import { APPLICATION_STATUS, DEFAULT_INTERVIEW_CRITERIA, ROLES } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { parseCriteria, passFail } from '@/lib/scoring';
import {
  Alert, Card, CardBody, DescriptionList, PageHeading, StatCard, StatusBadge,
} from '@/components/ui';
import { deletePanel } from '@/actions/assessment';
import { AssignCandidatesForm } from '../../examinations/forms';
import { ConsolidateForm, CriteriaForm, InterviewScoreForm, PanelForm } from '../forms';

export const dynamic = 'force-dynamic';

export default async function InterviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageAnyPermission([PERMISSIONS.INTERVIEW_MANAGE, PERMISSIONS.INTERVIEW_SCORE]);
  const canManage = hasPermission(user, PERMISSIONS.INTERVIEW_MANAGE);

  const schedule = await prisma.interviewSchedule.findUnique({
    where: { id },
    include: {
      exercise: { select: { id: true, title: true, reference: true, requireExam: true } },
      panels: {
        orderBy: { name: 'asc' },
        include: {
          members: { include: { user: { select: { id: true, fullName: true, role: true } } } },
          _count: { select: { candidates: true } },
        },
      },
      candidates: {
        orderBy: [{ panelId: 'asc' }, { slotTime: 'asc' }],
        include: {
          panel: { select: { id: true, name: true, members: { select: { userId: true } } } },
          application: {
            select: {
              id: true, reference: true, examScore: true,
              applicant: { select: { fullName: true, applicantProfile: { select: { lga: true } } } },
              vacancy: { select: { jobTitle: true, gradeLevel: true } },
            },
          },
          scores: { include: { member: { select: { id: true, fullName: true } } } },
        },
      },
    },
  });
  if (!schedule) notFound();

  const criteria = parseCriteria(schedule.criteria, [...DEFAULT_INTERVIEW_CRITERIA]);

  const [eligible, panelOfficers] = await Promise.all([
    canManage
      ? prisma.application.findMany({
          where: {
            exerciseId: schedule.exercise.id,
            status: { in: [APPLICATION_STATUS.EXAM_COMPLETED, APPLICATION_STATUS.SHORTLISTED] },
            interviewCandidates: { none: { scheduleId: schedule.id } },
          },
          select: {
            id: true, reference: true,
            applicant: { select: { fullName: true, applicantProfile: { select: { lga: true } } } },
            vacancy: { select: { jobTitle: true, gradeLevel: true } },
          },
          take: 500,
        })
      : [],
    canManage
      ? prisma.user.findMany({
          where: {
            active: true,
            role: { in: [ROLES.INTERVIEW_PANEL, ROLES.RECRUITMENT_DIRECTOR, ROLES.RECRUITMENT_OFFICER, ROLES.COMMISSION_ADMIN, ROLES.SUPER_ADMIN] },
          },
          orderBy: { fullName: 'asc' },
          select: { id: true, fullName: true, role: true },
        })
      : [],
  ]);

  const myPanelIds = new Set(
    schedule.panels.filter((p) => p.members.some((m) => m.user.id === user.id)).map((p) => p.id),
  );
  const visibleCandidates = canManage
    ? schedule.candidates
    : schedule.candidates.filter((c) => c.panelId && myPanelIds.has(c.panelId));

  const present = schedule.candidates.filter((c) => c.attendance === 'PRESENT');
  const absent = schedule.candidates.filter((c) => c.attendance === 'ABSENT');
  const pending = schedule.candidates.filter((c) => c.attendance === 'PENDING');
  const assessed = schedule.candidates.filter((c) => c.consolidatedScore !== null);

  return (
    <>
      <PageHeading
        title={schedule.title}
        description={`${schedule.exercise.title} (${schedule.exercise.reference}) · ${formatDate(schedule.interviewDate)} · ${schedule.venue}`}
        breadcrumb={[{ label: 'Interviews', href: '/admin/interviews' }, { label: schedule.title.slice(0, 40) }]}
        actions={
          <>
            <StatusBadge status={schedule.status} />
            {canManage ? (
              <Link href={`/api/reports/interview?id=${schedule.id}&format=pdf`} className="btn-secondary btn-sm">
                Export results
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Candidates" value={schedule.candidates.length} />
        <StatCard label="Present" value={present.length} tone="green" />
        <StatCard label="Absent" value={absent.length} tone={absent.length ? 'red' : 'default'} />
        <StatCard label="Awaiting attendance" value={pending.length} tone={pending.length ? 'amber' : 'default'} />
        <StatCard label="Assessed" value={assessed.length} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <div className="card-header">
              <h2 className="card-title">Candidates and score sheets</h2>
              <span className="badge-slate">{schedule.totalMarks} marks · pass {schedule.passMark}</span>
            </div>
            <CardBody>
              {visibleCandidates.length === 0 ? (
                <p className="text-sm text-slate-600">
                  {canManage
                    ? 'No candidates scheduled yet. Create a panel, then schedule candidates below.'
                    : 'No candidates have been assigned to your panel yet.'}
                </p>
              ) : (
                <ul className="space-y-4">
                  {visibleCandidates.map((c) => {
                    const myScore = c.scores.find((s) => s.member.id === user.id);
                    const existing = myScore ? (JSON.parse(myScore.scores) as Record<string, number>) : null;
                    // Only a member of this candidate's panel may score them.
                    const canScoreThis =
                      hasPermission(user, PERMISSIONS.INTERVIEW_SCORE) &&
                      Boolean(c.panelId && myPanelIds.has(c.panelId));
                    return (
                      <li key={c.id} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <Link href={`/admin/applications/${c.application.id}`} className="text-sm font-semibold text-kogi-700 hover:underline">
                              {c.application.applicant.fullName}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500">
                              <span className="font-mono">{c.application.reference}</span> ·{' '}
                              {c.application.vacancy ? `${c.application.vacancy.jobTitle} (${c.application.vacancy.gradeLevel})` : '—'} ·{' '}
                              {c.application.applicant.applicantProfile?.lga ?? '—'}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {c.panel?.name ?? 'No panel'} · slot {c.slotTime ?? '—'}
                              {c.application.examScore !== null ? ` · examination score ${c.application.examScore}` : ''}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={c.attendance} />
                            {c.consolidatedScore !== null ? (
                              <>
                                <span className="badge-blue">
                                  panel mean {c.consolidatedScore}/{schedule.totalMarks}
                                </span>
                                <StatusBadge status={passFail(c.consolidatedScore, schedule.passMark)} />
                              </>
                            ) : null}
                          </div>
                        </div>

                        {c.scores.length > 0 ? (
                          <ul className="mt-3 flex flex-wrap gap-1.5">
                            {c.scores.map((s) => (
                              <li key={s.id} className="badge-slate">
                                {s.member.fullName}: {s.total}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {c.remarks ? <p className="mt-2 text-xs text-slate-600">Remarks: {c.remarks}</p> : null}

                        {canScoreThis ? (
                          <details className="mt-3" open={!myScore}>
                            <summary className="cursor-pointer text-sm font-medium text-kogi-700">
                              {myScore ? 'Update my assessment' : 'Record my assessment'}
                            </summary>
                            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                              <InterviewScoreForm
                                candidateId={c.id}
                                criteria={criteria}
                                existing={existing}
                                attendance={c.attendance}
                                totalMarks={schedule.totalMarks}
                              />
                            </div>
                          </details>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          {canManage ? (
            <>
              <Card>
                <div className="card-header">
                  <h2 className="card-title">Schedule candidates</h2>
                  <span className="badge-slate">{eligible.length} eligible</span>
                </div>
                <CardBody>
                  {schedule.panels.length === 0 ? (
                    <Alert tone="warning">Create at least one interview panel before scheduling candidates.</Alert>
                  ) : (
                    <AssignCandidatesForm
                      scheduleId={schedule.id}
                      action="interview"
                      label="Schedule candidates and allocate time slots"
                      candidates={eligible.map((e) => ({
                        id: e.id,
                        reference: e.reference,
                        name: e.applicant.fullName,
                        position: e.vacancy ? `${e.vacancy.jobTitle} (${e.vacancy.gradeLevel})` : '—',
                        lga: e.applicant.applicantProfile?.lga ?? '—',
                      }))}
                    />
                  )}
                </CardBody>
              </Card>

              <Card>
                <div className="card-header"><h2 className="card-title">Assessment framework</h2></div>
                <CardBody>
                  <CriteriaForm scheduleId={schedule.id} criteria={criteria} />
                </CardBody>
              </Card>
            </>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Interview details</h2></div>
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Status', value: <StatusBadge status={schedule.status} /> },
                  { label: 'Date', value: formatDate(schedule.interviewDate) },
                  { label: 'Start time', value: schedule.startTime },
                  { label: 'End time', value: schedule.endTime ?? '—' },
                  { label: 'Venue', value: schedule.venue },
                  { label: 'Minutes per candidate', value: schedule.slotMinutes },
                  { label: 'Total marks', value: schedule.totalMarks },
                  { label: 'Pass mark', value: schedule.passMark },
                ]}
              />
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Assessment criteria</p>
                <ul className="mt-1.5 space-y-1">
                  {criteria.map((c) => (
                    <li key={c.key} className="flex justify-between text-xs">
                      <span className="text-slate-700">{c.label}</span>
                      <span className="font-semibold text-slate-900">{c.maxScore}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>

          <Card>
            <div className="card-header">
              <h2 className="card-title">Panels</h2>
              <span className="badge-slate">{schedule.panels.length}</span>
            </div>
            <CardBody className="space-y-4">
              {schedule.panels.length === 0 ? (
                <p className="text-sm text-slate-600">No panels configured.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {schedule.panels.map((p) => (
                    <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{p.name}</p>
                          <p className="text-xs text-slate-500">
                            {p.roomVenue ? `${p.roomVenue} · ` : ''}{p._count.candidates} candidate(s)
                          </p>
                          <ul className="mt-1 flex flex-wrap gap-1">
                            {p.members.map((m) => (
                              <li key={m.id} className={m.isChair ? 'badge-green' : 'badge-slate'}>
                                {m.user.fullName}{m.isChair ? ' (chair)' : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {canManage && p._count.candidates === 0 ? (
                          <form action={deletePanel}>
                            <input type="hidden" name="id" value={p.id} />
                            <button type="submit" className="btn-ghost btn-sm text-red-700">Remove</button>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {canManage ? <PanelForm scheduleId={schedule.id} officers={panelOfficers.map((o) => ({ id: o.id, name: o.fullName, role: o.role }))} /> : null}
            </CardBody>
          </Card>

          {canManage && schedule.status !== 'COMPLETED' ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Consolidate and advance</h2></div>
              <CardBody><ConsolidateForm scheduleId={schedule.id} /></CardBody>
            </Card>
          ) : null}

          {schedule.status === 'COMPLETED' ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Next step</h2></div>
              <CardBody>
                <p className="text-sm text-slate-700">
                  Interview assessments have been consolidated. Prepare the final selection list to
                  combine examination and interview results.
                </p>
                <Link href={`/admin/selection?exercise=${schedule.exercise.id}`} className="btn-primary btn-sm mt-3 w-full">
                  Go to final selection
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
