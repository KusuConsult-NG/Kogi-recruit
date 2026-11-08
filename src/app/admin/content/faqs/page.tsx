import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { deleteFaq } from '@/actions/content';
import { FaqForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'FAQs' };

export default async function FaqAdmin() {
  await requirePagePermission(PERMISSIONS.CONTENT_MANAGE);
  const faqs = await prisma.faq.findMany({ orderBy: [{ category: 'asc' }, { position: 'asc' }] });

  return (
    <>
      <PageHeading
        title="Frequently Asked Questions"
        description="Maintain the questions and answers shown on the public FAQ page."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {faqs.length === 0 ? (
            <Card><CardBody><p className="text-sm text-slate-600">No FAQs yet.</p></CardBody></Card>
          ) : (
            faqs.map((f) => (
              <Card key={f.id}>
                <div className="card-header">
                  <div>
                    <h2 className="card-title">{f.question}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">{f.category.toLowerCase()} · order {f.position}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.published ? <span className="badge-green">published</span> : <span className="badge-slate">hidden</span>}
                    <form action={deleteFaq}>
                      <input type="hidden" name="id" value={f.id} />
                      <button type="submit" className="btn-ghost btn-sm text-red-700">Delete</button>
                    </form>
                  </div>
                </div>
                <CardBody>
                  <FaqForm initial={{
                    id: f.id, question: f.question, answer: f.answer,
                    category: f.category, published: f.published, order: f.position,
                  }} />
                </CardBody>
              </Card>
            ))
          )}
        </div>
        <Card>
          <div className="card-header"><h2 className="card-title">Add a question</h2></div>
          <CardBody><FaqForm /></CardBody>
        </Card>
      </div>
    </>
  );
}
