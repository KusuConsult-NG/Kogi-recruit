import type { Metadata } from 'next';
import { Source_Serif_4, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { COMMISSION } from '@/lib/constants';

/**
 * An editorial serif for headings, a civic sans for text and forms, and a
 * monospace face for references, examination numbers and figures.
 */
const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-serif',
});

const sans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: `${COMMISSION.name} Portal`,
    template: `%s | ${COMMISSION.shortName}`,
  },
  description:
    'Official portal of the Kogi State Civil Service Commission, with an integrated Civil Service Recruitment Management System for vacancies, online applications, screening, computer-based examinations, interviews and recruitment outcomes.',
  applicationName: `${COMMISSION.name} Portal`,
  robots: { index: true, follow: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#21503e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-kogi-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to the main content
        </a>
        {children}
      </body>
    </html>
  );
}
