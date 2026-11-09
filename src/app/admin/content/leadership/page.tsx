import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { deleteLeadership } from '@/actions/content';
import { LeadershipForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leadership Profiles' };

export default async function LeadershipAdmin() {
  await requirePagePermission(PERMISSIONS.CONTENT_MANAGE);
  const profiles = await prisma.leadershipProfile.findMany({
    orderBy: [{ position_: 'asc' }, { name: 'asc' }],
  });

  return (
    <>
      <PageHeading
        title="Leadership Profiles"
        description="Approved leadership profiles shown on the public portal."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {profiles.length === 0 ? (
            <Card><CardBody><p className="text-sm text-ink-600">No profiles yet.</p></CardBody></Card>
          ) : (
            profiles.map((p) => (
              <Card key={p.id}>
                <div className="card-header">
                  <div>
                    <h2 className="card-title">{p.name}</h2>
                    <p className="mt-0.5 text-sm text-ink-500">{p.position}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.published ? <span className="badge-green">published</span> : <span className="badge-slate">hidden</span>}
                    <form action={deleteLeadership}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Delete</button>
                    </form>
                  </div>
                </div>
                <CardBody>
                  <LeadershipForm
                    initial={{
                      id: p.id, name: p.name, position: p.position, bio: p.bio ?? '',
                      email: p.email ?? '', published: p.published, order: p.position_,
                    }}
                  />
                </CardBody>
              </Card>
            ))
          )}
        </div>
        <Card>
          <div className="card-header"><h2 className="card-title">Add a profile</h2></div>
          <CardBody><LeadershipForm /></CardBody>
        </Card>
      </div>
    </>
  );
}
