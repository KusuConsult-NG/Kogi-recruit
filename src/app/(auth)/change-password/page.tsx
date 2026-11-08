import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { Card, CardBody } from '@/components/ui';
import { ChangePasswordForm } from './form';

export const metadata = { title: 'Change password' };

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/change-password');

  return (
    <Card>
      <CardBody className="p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Change your password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Signed in as {user.fullName} ({user.email}).
        </p>
        <div className="mt-6">
          <ChangePasswordForm />
        </div>
        <p className="mt-6 border-t border-slate-200 pt-4 text-sm">
          <Link href={user.role === ROLES.APPLICANT ? '/portal' : '/admin'} className="text-kogi-700 hover:underline">
            ← Back to dashboard
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
