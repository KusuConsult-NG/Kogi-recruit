import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageAnyPermission } from '@/lib/page-guards';
import { hasAnyPermission, hasPermission, PERMISSIONS } from '@/lib/rbac';
import { APPLICATION_STATUS, EXAM_MODE_LABELS, SITTING_STATUS_LABELS } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import { passFail } from '@/lib/scoring';
import {
  Alert, Card, CardBody, DescriptionList, PageHeading, StatCard, StatusBadge,
} from '@/components/ui';
import { deleteExamCentre } from '@/actions/assessment';
import { forceSubmitSitting } from '@/actions/cbt';
import {
  AssignCandidatesForm, BulkScoreForm, ExamCentreForm, ExamScoreRow,
  ReleaseOnlineTestForm, ValidateExamForm,
} from '../forms';

export const dynamic = 'force-dynamic';

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageAnyPermission([PERMISSIONS.EXAM_MANAGE, PERMISSIONS.EXAM_SCORE]);
  const canManage = hasPermission(user, PERMISSIONS.EXAM_MANAGE);
  const canScore = hasPermission(user, PERMISSIONS.EXAM_SCORE);

  const schedule = await prisma.examSchedule.findUnique({
    where: { id },
    include: {
      exercise: { select: { id: true, title: true, reference: true } },
      paper: {
        select: {
          id: true, title: true, code: true, status: true, durationMinutes: true,
          passMark: true, showResultToCandidate: true,
        },
      },
      centres: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { candidates: true } } },
      },
      candidates: {
        orderBy: { examNumber: 'asc' },
        include: {
          centre: { select: { name: true } },
          sitting: {
            select: {
              id: true, status: true, startedAt: true, submittedAt: true, submittedBy: true,
              rawScore: true, totalMarks: true, percentage: true, answeredCount: true,
            },
          },
          application: {
            select: {
              id: true, reference: true,
              applicant: { select: { fullName: true, applicantProfile: { select: { lga: true } } } },
              vacancy: { select: { jobTitle: true, gradeLevel: true } },
            },
          },
        },
      },
    },
  });
  if (!schedule) notFound();

  const eligible = await prisma.application.findMany({
    where: {
      exerciseId: schedule.exercise.id,
      status: APPLICATION_STATUS.SHORTLISTED,
      examCandidates: { none: { scheduleId: schedule.id } },
    },
    select: {
      id: true, reference: true,
      applicant: { select: { fullName: true, applicantProfile: { select: { lga: true } } } },
      vacancy: { select: { jobTitle: true, gradeLevel: true } },
    },
    take: 500,
  });

  const present = schedule.candidates.filter((c) => c.attendance === 'PRESENT');
  const absent = schedule.candidates.filter((c) => c.attendance === 'ABSENT');
  const pending = schedule.candidates.filter((c) => c.attendance === 'PENDING');
  const scored = schedule.candidates.filter((c) => c.score !== null);
  const passed = scored.filter((c) => (c.score ?? 0) >= schedule.passMark);
  const totalCapacity = schedule.centres.reduce((s, c) => s + c.capacity, 0);

  // Online testing
  const online = schedule.mode === 'CBT' || schedule.mode === 'HYBRID';
  const sittings = schedule.candidates.map((c) => c.sitting).filter(Boolean);
  const notReleased = schedule.candidates.filter((c) => !c.sitting).length;
  const inProgress = sittings.filter((s) => s!.status === 'IN_PROGRESS');
  const submittedSittings = sittings.filter((s) => s!.submittedAt);
  const notStarted = sittings.filter((s) => s!.status === 'NOT_STARTED').length;

  return (
    <>
      <PageHeading
        title={schedule.title}
        eyebrow={`Stage 7 · ${EXAM_MODE_LABELS[schedule.mode] ?? schedule.mode}`}
        description={`${schedule.exercise.title} (${schedule.exercise.reference}) · ${formatDate(schedule.examDate)} at ${schedule.startTime}`}
        breadcrumb={[{ label: 'Examinations', href: '/admin/examinations' }, { label: schedule.title.slice(0, 40) }]}
        actions={
          <>
            <StatusBadge status={schedule.status} />
            <Link href={`/api/reports/examination?id=${schedule.id}&format=pdf`} className="btn-secondary btn-sm">
              Export results
            </Link>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard label="Candidates" value={schedule.candidates.length} />
        <StatCard label="Seats available" value={Math.max(0, totalCapacity - schedule.candidates.length)} />
        <StatCard label="Present" value={present.length} tone="green" />
        <StatCard label="Absent" value={absent.length} tone={absent.length ? 'red' : 'default'} />
        <StatCard label="Awaiting attendance" value={pending.length} tone={pending.length ? 'amber' : 'default'} />
        <StatCard label="Passed" value={`${passed.length}/${scored.length}`} tone="green" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <div className="card-header"><h2 className="card-title">Examination details</h2></div>
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Status', value: <StatusBadge status={schedule.status} /> },
                  { label: 'Mode', value: <StatusBadge status={schedule.mode} label={EXAM_MODE_LABELS[schedule.mode] ?? schedule.mode} /> },
                  { label: 'Date', value: formatDate(schedule.examDate) },
                  { label: 'Reporting time', value: schedule.startTime },
                  { label: 'End time', value: schedule.endTime ?? '—' },
                  { label: 'Total marks', value: schedule.totalMarks },
                  { label: 'Pass mark', value: schedule.passMark },
                  { label: 'Results released', value: schedule.resultsPublishedAt ? formatDateTime(schedule.resultsPublishedAt) : 'Not released' },
                ]}
              />
              {schedule.instructions ? (
                <div className="mt-3 border-t border-ink-100 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Instructions</p>
                  <p className="mt-1 whitespace-pre-line text-xs text-ink-700">{schedule.instructions}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <div className="card-header">
              <h2 className="card-title">Examination centres</h2>
              <span className="badge-slate">{totalCapacity} seats</span>
            </div>
            <CardBody className="space-y-4">
              {schedule.centres.length === 0 ? (
                <p className="text-sm text-ink-600">No centres configured.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {schedule.centres.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-ink-950">{c.name}</p>
                        <p className="text-xs text-ink-500">
                          {c.lga ? `${c.lga} · ` : ''}{c._count.candidates}/{c.capacity} allocated
                          {c.supervisor ? ` · supervisor ${c.supervisor}` : ''}
                        </p>
                        {c.address ? <p className="text-xs text-ink-500">{c.address}</p> : null}
                      </div>
                      {canManage && c._count.candidates === 0 ? (
                        <form action={deleteExamCentre}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Remove</button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canManage ? <ExamCentreForm scheduleId={schedule.id} /> : null}
            </CardBody>
          </Card>

          {canManage && schedule.status !== 'COMPLETED' ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Validate and advance</h2></div>
              <CardBody><ValidateExamForm scheduleId={schedule.id} /></CardBody>
            </Card>
          ) : null}

          {schedule.status === 'COMPLETED' ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Results summary</h2></div>
              <CardBody>
                <DescriptionList
                  columns={1}
                  items={[
                    { label: 'Candidates assessed', value: scored.length },
                    { label: 'Passed', value: `${passed.length} (${scored.length ? Math.round((passed.length / scored.length) * 100) : 0}%)` },
                    { label: 'Failed', value: scored.length - passed.length },
                    { label: 'Absent', value: absent.length },
                    { label: 'Highest score', value: scored.length ? Math.max(...scored.map((c) => c.score ?? 0)) : '—' },
                    { label: 'Average score', value: scored.length ? (scored.reduce((s, c) => s + (c.score ?? 0), 0) / scored.length).toFixed(2) : '—' },
                  ]}
                />
                <Link href={`/admin/interviews?exercise=${schedule.exercise.id}`} className="btn-primary btn-sm mt-4 w-full">
                  Proceed to interview stage
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <div className="card-header">
              <h2 className="card-title">Candidate list and score sheet</h2>
              <span className="badge-slate">{schedule.totalMarks} marks · pass {schedule.passMark}</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Exam no.</th><th>Candidate</th><th>Position</th><th>Centre</th><th>Seat</th>
                    <th>Attendance</th><th>Score</th><th>Result</th>
                    {canScore ? <th>Record</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {schedule.candidates.map((c) => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap font-mono text-xs">{c.examNumber}</td>
                      <td>
                        <Link href={`/admin/applications/${c.application.id}`} className="text-xs font-medium text-kogi-700 hover:underline">
                          {c.application.applicant.fullName}
                        </Link>
                        <p className="font-mono text-2xs text-ink-500">{c.application.reference}</p>
                      </td>
                      <td className="text-xs">{c.application.vacancy?.jobTitle ?? '—'}</td>
                      <td className="text-xs">{c.centre?.name ?? '—'}</td>
                      <td className="text-xs">{c.seatNumber ?? '—'}</td>
                      <td><StatusBadge status={c.attendance} /></td>
                      <td className="whitespace-nowrap text-xs font-semibold">
                        {c.score !== null ? `${c.score}/${schedule.totalMarks}` : '—'}
                      </td>
                      <td><StatusBadge status={passFail(c.score, schedule.passMark)} /></td>
                      {canScore ? (
                        <td>
                          <ExamScoreRow
                            candidateId={c.id}
                            attendance={c.attendance}
                            score={c.score}
                            remarks={c.remarks}
                            totalMarks={schedule.totalMarks}
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {schedule.candidates.length === 0 ? (
                    <tr><td colSpan={9} className="py-6 text-center text-sm text-ink-500">
                      No candidates allocated yet. Add centres, then assign shortlisted candidates.
                    </td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          {online ? (
            <Card>
              <div className="card-header">
                <h2 className="card-title">Online test</h2>
                <StatusBadge status={schedule.mode} label={EXAM_MODE_LABELS[schedule.mode] ?? schedule.mode} />
              </div>
              <CardBody className="space-y-4">
                {!schedule.paper ? (
                  <Alert tone="error" title="No paper attached">
                    This examination is set to be sat online but no paper is attached, so candidates
                    cannot sit it. Attach a published paper when creating the examination.
                  </Alert>
                ) : (
                  <>
                    <DescriptionList
                      columns={2}
                      items={[
                        {
                          label: 'Paper',
                          value: (
                            <Link href={`/admin/exams/papers/${schedule.paper.id}`} className="link">
                              {schedule.paper.title} ({schedule.paper.code})
                            </Link>
                          ),
                        },
                        { label: 'Duration allowed', value: `${schedule.durationMinutes ?? schedule.paper.durationMinutes} minutes` },
                        { label: 'Test opens', value: schedule.opensAt ? formatDateTime(schedule.opensAt) : 'As soon as released' },
                        { label: 'Test closes', value: schedule.closesAt ? formatDateTime(schedule.closesAt) : 'No closing time set' },
                        { label: 'Score shown to candidate', value: schedule.paper.showResultToCandidate ? 'Immediately on submission' : 'Withheld until released' },
                        { label: 'Marking', value: 'Automatic; scaled onto this examination’s total marks' },
                      ]}
                    />

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <StatCard label="Tests released" value={sittings.length} />
                      <StatCard label="Not yet started" value={notStarted} tone={notStarted ? 'amber' : 'default'} />
                      <StatCard label="In progress" value={inProgress.length} tone="blue" />
                      <StatCard label="Submitted" value={submittedSittings.length} tone="green" />
                    </div>

                    {canManage ? (
                      notReleased > 0 ? (
                        <div className="panel-inset">
                          <p className="mb-3 text-sm text-ink-700">
                            <strong className="font-semibold">{notReleased}</strong> allocated candidate(s)
                            do not yet have a sitting. Releasing the test lets them start it from their
                            portal once the opening time is reached.
                          </p>
                          <ReleaseOnlineTestForm scheduleId={schedule.id} count={notReleased} />
                        </div>
                      ) : (
                        <Alert tone="success">
                          Every allocated candidate has a sitting for this test.
                        </Alert>
                      )
                    ) : null}

                    {sittings.length > 0 ? (
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Exam no.</th><th>Status</th><th>Started</th>
                              <th className="num">Answered</th><th className="num">Raw score</th>
                              <th className="num">Percentage</th><th>Submitted</th>
                              {canManage ? <th /> : null}
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.candidates
                              .filter((c) => c.sitting)
                              .map((c) => (
                                <tr key={c.sitting!.id}>
                                  <td><span className="ref">{c.examNumber}</span></td>
                                  <td>
                                    <StatusBadge
                                      status={c.sitting!.status}
                                      label={SITTING_STATUS_LABELS[c.sitting!.status]}
                                    />
                                  </td>
                                  <td className="text-xs">
                                    {c.sitting!.startedAt ? formatDateTime(c.sitting!.startedAt) : '—'}
                                  </td>
                                  <td className="num">{c.sitting!.answeredCount}</td>
                                  <td className="num">
                                    {c.sitting!.submittedAt ? `${c.sitting!.rawScore}/${c.sitting!.totalMarks}` : '—'}
                                  </td>
                                  <td className="num font-semibold">
                                    {c.sitting!.percentage === null ? '—' : `${c.sitting!.percentage}%`}
                                  </td>
                                  <td className="text-xs">
                                    {c.sitting!.submittedAt ? (
                                      <>
                                        {formatDateTime(c.sitting!.submittedAt)}
                                        <span className="block text-ink-500">
                                          {c.sitting!.submittedBy === 'TIMER'
                                            ? 'time ran out'
                                            : c.sitting!.submittedBy === 'OFFICER'
                                              ? 'closed by officer'
                                              : 'by candidate'}
                                        </span>
                                      </>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  {canManage ? (
                                    <td>
                                      {c.sitting!.status === 'IN_PROGRESS' ? (
                                        <form action={forceSubmitSitting}>
                                          <input type="hidden" name="id" value={c.sitting!.id} />
                                          <button type="submit" className="btn-ghost btn-sm">
                                            Close sitting
                                          </button>
                                        </form>
                                      ) : null}
                                    </td>
                                  ) : null}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </>
                )}
              </CardBody>
            </Card>
          ) : null}

          {canManage ? (
            <Card>
              <div className="card-header">
                <h2 className="card-title">Allocate shortlisted candidates</h2>
                <span className="badge-slate">{eligible.length} eligible</span>
              </div>
              <CardBody>
                {schedule.centres.length === 0 && schedule.mode !== 'CBT' ? (
                  <Alert tone="warning">Add at least one examination centre before allocating candidates.</Alert>
                ) : (
                  <AssignCandidatesForm
                    scheduleId={schedule.id}
                    action="exam"
                    label="Allocate to centres and issue examination numbers"
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
          ) : null}

          {canScore ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Bulk score upload</h2></div>
              <CardBody><BulkScoreForm scheduleId={schedule.id} /></CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
