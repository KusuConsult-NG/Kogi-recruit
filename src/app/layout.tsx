import type { Metadata } from 'next';
import './globals.css';
import { COMMISSION } from '@/lib/constants';

export const metadata: Metadata = {
  title: {
    default: `${COMMISSION.name} Portal`,
    template: `%s | ${COMMISSION.shortName}`,
  },
  description:
    'Official portal of the Kogi State Civil Service Commission, with an integrated Civil Service Recruitment Management System for vacancies, online applications, screening, examinations, interviews and recruitment outcomes.',
  applicationName: `${COMMISSION.name} Portal`,
  robots: { index: true, follow: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#106441',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body>{children}</body>
    </html>
  );
}
