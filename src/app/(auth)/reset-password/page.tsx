import Link from 'next/link';
import { Alert, Card, CardBody } from '@/components/ui';
import { ResetPasswordForm } from './form';

export const metadata = { title: 'Set a new password' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Card>
      <CardBody className="p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Set a new password</h1>
        {!token ? (
          <div className="mt-4">
            <Alert tone="error" title="Reset link missing">
              This page must be opened from the link in your password reset email.{' '}
              <Link href="/forgot-password" className="underline">Request a new link</Link>.
            </Alert>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Choose a new password for your account. All other sessions will be signed out.
            </p>
            <div className="mt-6">
              <ResetPasswordForm token={token} />
            </div>
          </>
        )}
        <p className="mt-6 border-t border-slate-200 pt-4 text-sm">
          <Link href="/login" className="text-kogi-700 hover:underline">← Back to sign in</Link>
        </p>
      </CardBody>
    </Card>
  );
}
