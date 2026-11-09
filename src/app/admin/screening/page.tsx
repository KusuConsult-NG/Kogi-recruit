import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageAnyPermission } from '@/lib/page-guards';
import { hasAnyPermission, PERMISSIONS } from '@/lib/rbac';
import { APPLICATION_STATUS, ROLES } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { Alert, Card, PageHeading, StatCard, Tabs } from '@/components/ui';
import { ScreeningWorkspace, type QueueRow } from './bulk';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Screening' };

/** Module 2.5 - screening workspace. */
export default async function ScreeningPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageAnyPermission([PERMISSIONS.SCREENING_PERFORM, PERMISSIONS.SCREENING_ASSIGN]);
  const view = sp.view === 'mine' ? 'mine' : sp.view === 'shortlist' ? 'shortlist' : 'queue';

  const queueStatuses =
    view === 'shortlist'
      ? [APPLICATION_STATUS.QUALIFIED]
      : [APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.UNDER_SCREENING, APPLICATION_STATUS.RESUBMISSION_REQUIRED];

  const where = {
    status: { in: queueStatuses },
    ...(sp.exercise ? { exerciseId: sp.exercise } : {}),
    ...(view === 'mine' ? { assignments: { some: { officerId: user.id, completedAt: null } } } : {}),
  };

  const [applications, exercises, officers, counts] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: [{ submittedAt: 'asc' }],
      take: 200,
      include: {
        exercise: { select: { title: true, reference: true } },
        vacancy: { select: { jobTitle: true, gradeLevel: true } },
        applicant: { select: { fullName: true, applicantProfile: { select: { applicantRef: true, lga: true } } } },
        documents: { select: { reviewStatus: true } },
        assignments: { include: { officer: { select: { fullName: true } } } },
      },
    }),
    prisma.recruitmentExercise.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, title: true, reference: true } }),
    prisma.user.findMany({
      where: {
        active: true,
        role: { in: [ROLES.SCREENING_OFFICER, ROLES.DOCUMENT_OFFICER, ROLES.RECRUITMENT_OFFICER, ROLES.RECRUITMENT_DIRECTOR, ROLES.COMMISSION_ADMIN] },
      },
      orderBy: { fullName: 'asc' },
      select: {
        id: true, fullName: true, role: true,
        _count: { select: { screeningAssignments: { where: { completedAt: null } } } },
      },
    }),
    Promise.all([
      prisma.application.count({ where: { status: { in: [APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.UNDER_SCREENING, APPLICATION_STATUS.RESUBMISSION_REQUIRED] }, ...(sp.exercise ? { exerciseId: sp.exercise } : {}) } }),
      prisma.screeningAssignment.count({ where: { officerId: user.id, completedAt: null } }),
      prisma.application.count({ where: { status: APPLICATION_STATUS.QUALIFIED, ...(sp.exercise ? { exerciseId: sp.exercise } : {}) } }),
      prisma.application.count({ where: { status: APPLICATION_STATUS.DISQUALIFIED, ...(sp.exercise ? { exerciseId: sp.exercise } : {}) } }),
    ]),
  ]);

  const [queueTotal, myTotal, qualifiedTotal, disqualifiedTotal] = counts;

  const rows: QueueRow[] = applications.map((a) => {
    const verified = a.documents.filter((d) => d.reviewStatus === 'VERIFIED').length;
    const rejected = a.documents.filter((d) => ['REJECTED', 'RESUBMISSION_REQUIRED'].includes(d.reviewStatus)).length;
    return {
      id: a.id,
      reference: a.reference,
      applicantName: a.applicant.fullName,
      applicantRef: a.applicant.applicantProfile?.applicantRef ?? '—',
      lga: a.applicant.applicantProfile?.lga ?? '—',
      exercise: a.exercise.reference,
      position: a.vacancy ? `${a.vacancy.jobTitle} (${a.vacancy.gradeLevel})` : '—',
      status: a.status,
      completeness: a.completeness,
      documents: `${verified}/${a.documents.length}${rejected ? ` · ${rejected} rejected` : ''}`,
      officers: a.assignments.map((x) => x.officer.fullName).join(', '),
      submittedAt: a.submittedAt ? formatDate(a.submittedAt) : '—',
    };
  });

  const base = `/admin/screening${sp.exercise ? `?exercise=${sp.exercise}&` : '?'}`;

  return (
    <>
      <PageHeading
        title="Application Screening"
        description="Stage 5 and 6 — review eligibility and document completeness, record outcomes and prepare shortlists."
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Awaiting screening" value={queueTotal} tone={queueTotal ? 'amber' : 'default'} />
        <StatCard label="Assigned to me" value={myTotal} tone={myTotal ? 'blue' : 'default'} />
        <StatCard label="Qualified" value={qualifiedTotal} tone="green" />
        <StatCard label="Disqualified" value={disqualifiedTotal} tone={disqualifiedTotal ? 'red' : 'default'} />
      </div>

      <Card className="mb-5">
        <form method="get" className="flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="view" value={view} />
          <label className="flex-1 min-w-[16rem]">
            <span className="label">Recruitment exercise</span>
            <select name="exercise" defaultValue={sp.exercise ?? ''} className="select">
              <option value="">All exercises</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.reference} — {e.title}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary btn-sm">Apply</button>
          <Link href="/admin/screening" className="btn-ghost btn-sm">Reset</Link>
        </form>
      </Card>

      <Tabs
        active={`${base}view=${view}`}
        tabs={[
          { label: 'Screening queue', href: `${base}view=queue`, count: queueTotal },
          { label: 'Assigned to me', href: `${base}view=mine`, count: myTotal },
          { label: 'Ready to shortlist', href: `${base}view=shortlist`, count: qualifiedTotal },
        ]}
      />

      <ScreeningWorkspace
        rows={rows}
        officers={officers.map((o) => ({
          id: o.id, name: o.fullName, role: o.role, pending: o._count.screeningAssignments,
        }))}
        mode={view === 'shortlist' ? 'shortlist' : 'queue'}
        exerciseId={sp.exercise}
      />
    </>
  );
}
