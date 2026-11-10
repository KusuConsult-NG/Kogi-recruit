import Link from 'next/link';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { TrackForm } from './track-form';

export const metadata = { title: 'Track an Application' };

export default function TrackPage() {
  return (
    <div className="container-page py-10">
      <PageHeading
        eyebrow="Applicant services"
        title="Track an Application"
        description="Check the progress of a submitted application using the reference number on your acknowledgement."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Track Application' }]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="card-header"><h2 className="card-title">Enter your details</h2></div>
            <CardBody><TrackForm /></CardBody>
          </Card>
        </div>
        <Card>
          <div className="card-header"><h2 className="card-title">Need more detail?</h2></div>
          <CardBody className="text-sm text-ink-700">
            <p>
              Signing in to your applicant dashboard shows your full application, document review
              status, notifications and complete application history.
            </p>
            <Link href="/login" className="btn-primary btn-sm mt-4 w-full">Applicant sign in</Link>
            <Link href="/register" className="btn-secondary btn-sm mt-2 w-full">Create an account</Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
