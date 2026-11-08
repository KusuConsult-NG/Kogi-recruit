import Link from 'next/link';
import { prisma } from '@/lib/db';
import { WORKFLOW_STAGES, DOCUMENT_TYPES } from '@/lib/constants';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { RichText } from '@/components/rich-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Recruitment Process' };

export default async function ProcessPage() {
  const page = await prisma.pageContent.findUnique({ where: { slug: 'recruitment-process' } });

  return (
    <div className="container-page py-10">
      <PageHeading
        title="The Recruitment Process"
        description="Every approved recruitment exercise follows the same ten documented stages, from planning through to closure and archiving."
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Recruitment', href: '/recruitment' },
          { label: 'Process' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {page ? (
            <Card>
              <div className="card-header"><h2 className="card-title">{page.title}</h2></div>
              <CardBody><RichText body={page.body} /></CardBody>
            </Card>
          ) : null}

          <Card>
            <div className="card-header"><h2 className="card-title">The ten stages</h2></div>
            <CardBody>
              <ol className="space-y-4">
                {WORKFLOW_STAGES.map((stage) => (
                  <li key={stage.key} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kogi-700 text-sm font-bold text-white">
                      {stage.n}
                    </span>
                    <div className="border-b border-slate-100 pb-4">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Stage {stage.n} — {stage.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">{stage.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <div className="card-header"><h2 className="card-title">Documents commonly required</h2></div>
            <CardBody>
              <p className="mb-3 text-sm text-slate-600">
                The exact documents required are specified on each recruitment exercise. These are the
                document categories supported by the portal.
              </p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DOCUMENT_TYPES.map((d) => (
                  <li key={d.code} className="rounded border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    {d.label}
                    <span className="mt-0.5 block text-xs text-slate-500">Up to {d.maxMb}MB</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Before you apply</h2></div>
            <CardBody className="text-sm text-slate-700">
              <ul className="list-disc space-y-2 pl-4">
                <li>Scan your certificates and documents clearly, as PDF or JPEG.</li>
                <li>Use an email address you check regularly — all invitations are sent there.</li>
                <li>Complete your profile fully before starting an application.</li>
                <li>Submit before the closing date; the portal will not accept late applications.</li>
                <li>Keep your application reference number safe.</li>
              </ul>
            </CardBody>
          </Card>
          <Card>
            <div className="card-header"><h2 className="card-title">Important notice</h2></div>
            <CardBody className="text-sm text-slate-700">
              <p>
                The portal supports recruitment administration and records. It does not independently
                determine legal eligibility or make statutory recruitment decisions. Final approval of
                successful candidates remains with the legally authorised government authorities.
              </p>
              <p className="mt-2 font-medium text-slate-900">
                No payment of any kind is required to apply for any position advertised on this portal.
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Link href="/recruitment" className="btn-primary w-full">View current vacancies</Link>
              <Link href="/faqs" className="btn-secondary mt-2 w-full">Frequently asked questions</Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
