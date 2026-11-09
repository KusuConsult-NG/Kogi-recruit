import Link from 'next/link';
import { Card, CardBody } from '@/components/ui';
import { ForgotPasswordForm } from './form';

export const metadata = { title: 'Password recovery' };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardBody className="p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Password recovery</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter the email address registered on your account. A single-use reset link valid for 60
          minutes will be sent to you.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
        <p className="mt-6 border-t border-slate-200 pt-4 text-sm">
          <Link href="/login" className="text-kogi-700 hover:underline">← Back to sign in</Link>
        </p>
      </CardBody>
    </Card>
  );
}
