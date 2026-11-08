import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { Card, CardBody, Alert } from '@/components/ui';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; signedout?: string; registered?: string }>;
}) {
  const sp = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(user.role === ROLES.APPLICANT ? '/portal' : '/admin');

  return (
    <Card>
      <CardBody className="p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Sign in to the portal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Applicants and authorised Commission officers sign in here. You will only see the functions
          assigned to your role.
        </p>

        {sp.signedout ? (
          <div className="mt-4">
            <Alert tone="success">You have been signed out successfully.</Alert>
          </div>
        ) : null}

        <div className="mt-6">
          <LoginForm next={sp.next} />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-sm">
          <Link href="/forgot-password" className="text-kogi-700 hover:underline">
            Forgotten your password?
          </Link>
          <p className="text-slate-600">
            New applicant?{' '}
            <Link href="/register" className="font-semibold text-kogi-700 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
