import { prisma } from '@/lib/db';
import { requirePageApplicant } from '@/lib/page-guards';
import { Alert, Card, CardBody, PageHeading } from '@/components/ui';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Profile' };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const user = await requirePageApplicant();
  const profile = await prisma.applicantProfile.findUniqueOrThrow({ where: { userId: user.id } });

  return (
    <>
      <PageHeading
        title="My Profile"
        description="Your personal and contact details are used on every application you make. Keep them accurate and up to date."
        breadcrumb={[{ label: 'Dashboard', href: '/portal' }, { label: 'My Profile' }]}
      />
      {welcome ? (
        <div className="mb-6">
          <Alert tone="success" title="Welcome to the applicant portal">
            Your account has been created. Complete the details below to unlock applications. Your
            applicant reference is <span className="font-mono font-semibold">{profile.applicantRef}</span>.
          </Alert>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card>
            <div className="card-header">
              <h2 className="card-title">Personal and contact details</h2>
              {profile.profileComplete ? <span className="badge-green">complete</span> : <span className="badge-amber">incomplete</span>}
            </div>
            <CardBody>
              <ProfileForm
                profile={{
                  surname: profile.surname,
                  firstName: profile.firstName,
                  middleName: profile.middleName ?? '',
                  gender: profile.gender ?? '',
                  dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : '',
                  maritalStatus: profile.maritalStatus ?? '',
                  nin: profile.nin ?? '',
                  phone: profile.phone ?? '',
                  altPhone: profile.altPhone ?? '',
                  residentialAddress: profile.residentialAddress ?? '',
                  city: profile.city ?? '',
                  stateOfResidence: profile.stateOfResidence ?? '',
                  stateOfOrigin: profile.stateOfOrigin ?? '',
                  lga: profile.lga ?? '',
                  disability: profile.disability ?? '',
                }}
              />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Account</h2></div>
            <CardBody className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Applicant reference</p>
                <p className="font-mono font-semibold text-ink-950">{profile.applicantRef}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Email address</p>
                <p className="text-ink-800">{user.email}</p>
                <p className="hint">Contact the Commission if your email address needs to change.</p>
              </div>
              <a href="/change-password" className="btn-secondary btn-sm w-full">Change password</a>
            </CardBody>
          </Card>
          <Card>
            <div className="card-header"><h2 className="card-title">Data protection</h2></div>
            <CardBody className="text-xs leading-relaxed text-ink-600">
              Your personal information is processed by the Commission for recruitment administration in
              accordance with the Nigeria Data Protection Act 2023. It is not publicly accessible and is
              visible only to authorised officers acting within their roles. All access is logged.
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
