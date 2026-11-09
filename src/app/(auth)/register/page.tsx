import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { Card, CardBody } from '@/components/ui';
import { RegisterForm } from './register-form';

export const metadata = { title: 'Create an applicant account' };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === ROLES.APPLICANT ? '/portal' : '/admin');

  return (
    <Card>
      <CardBody className="p-6 sm:p-8">
        <h1 className="text-xl font-bold text-ink-950">Create an applicant account</h1>
        <p className="mt-1 text-sm text-ink-600">
          You need one account only. Once registered you can apply for any open recruitment exercise,
          upload your documents and track your application at every stage.
        </p>
        <div className="mt-6">
          <RegisterForm />
        </div>
        <p className="mt-6 border-t border-ink-200 pt-4 text-sm text-ink-600">
          Already registered?{' '}
          <Link href="/login" className="font-semibold text-kogi-700 hover:underline">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
