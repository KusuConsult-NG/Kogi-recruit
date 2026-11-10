import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { formatDateTime } from '@/lib/format';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { PageContentForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Institutional Pages' };

const MANAGED_PAGES = [
  { slug: 'homepage', label: 'Homepage hero', hint: 'The heading and introduction shown at the top of the public homepage.' },
  { slug: 'about', label: 'Commission profile', hint: 'Shown on “The Commission” page.' },
  { slug: 'mandate', label: 'Mandate', hint: 'The Commission’s statutory mandate.' },
  { slug: 'functions', label: 'Functions and responsibilities', hint: 'Recruitment, appointment, promotion, discipline and other personnel functions.' },
  { slug: 'vision-mission', label: 'Vision and mission', hint: 'Shown in the sidebar of “The Commission” page.' },
  { slug: 'recruitment-process', label: 'Recruitment process', hint: 'Introduction to the ten-stage recruitment process page.' },
  { slug: 'privacy', label: 'Privacy notice', hint: 'How personal information submitted through the portal is processed.' },
];

/** Module 1 - institutional content management. */
export default async function PagesAdmin() {
  await requirePagePermission(PERMISSIONS.CONTENT_MANAGE);
  const pages = await prisma.pageContent.findMany();
  const bySlug = new Map(pages.map((p) => [p.slug, p]));

  return (
    <>
      <PageHeading
        title="Institutional Pages"
        description="Maintain the Commission's homepage, profile, mandate, functions, vision and privacy notice. Changes appear on the public portal immediately."
      />
      <div className="space-y-6">
        {MANAGED_PAGES.map((p) => {
          const record = bySlug.get(p.slug);
          return (
            <Card key={p.slug}>
              <div className="card-header">
                <div>
                  <h2 className="card-title">{p.label}</h2>
                  <p className="mt-0.5 text-sm text-ink-500">{p.hint}</p>
                </div>
                <div className="text-right">
                  <span className="badge-slate">{p.slug}</span>
                  {record ? (
                    <p className="mt-1 text-2xs text-ink-500">Updated {formatDateTime(record.updatedAt)}</p>
                  ) : (
                    <p className="mt-1 text-2xs text-gold-700">Not yet created</p>
                  )}
                </div>
              </div>
              <CardBody>
                <PageContentForm
                  slug={p.slug}
                  initial={record ? {
                    title: record.title,
                    subtitle: record.subtitle ?? '',
                    body: record.body,
                    published: record.published,
                  } : undefined}
                />
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
