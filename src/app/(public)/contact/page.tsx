import { COMMISSION } from '@/lib/constants';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { EnquiryForm } from './enquiry-form';

export const metadata = { title: 'Contact and Enquiries' };

export default function ContactPage() {
  return (
    <div className="container-page py-10">
      <PageHeading
        title="Contact and Enquiries"
        description="Submit an enquiry to the Commission. Every enquiry is logged with a reference number and routed to the responsible officer."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Contact' }]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="card-header"><h2 className="card-title">Submit an enquiry</h2></div>
            <CardBody><EnquiryForm /></CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Commission Secretariat</h2></div>
            <CardBody className="space-y-3 text-sm text-slate-700">
              <p>{COMMISSION.address}</p>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Telephone</p>
                <p>{COMMISSION.phone}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</p>
                <p>{COMMISSION.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Office hours</p>
                <p>Monday to Friday, 8:00am – 4:00pm (excluding public holidays)</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <div className="card-header"><h2 className="card-title">Before you write</h2></div>
            <CardBody className="text-sm text-slate-700">
              <ul className="list-disc space-y-1.5 pl-4">
                <li>Check the <a href="/faqs" className="text-kogi-700 underline">frequently asked questions</a>.</li>
                <li>To check the progress of an application, use <a href="/track" className="text-kogi-700 underline">application tracking</a>.</li>
                <li>Quote your application reference in any recruitment enquiry.</li>
                <li>Do not send passwords or payment details by email.</li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
