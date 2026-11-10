import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { COMMISSION } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { Card, CardBody, DescriptionList, PageHeading } from '@/components/ui';
import { SettingsForm } from './form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System Settings' };

const SETTING_GROUPS = [
  {
    group: 'COMMISSION',
    label: 'Commission details',
    description: 'Shown on the public portal, in notifications and on exported reports.',
    fields: [
      { key: 'commission.name', label: 'Commission name', type: 'text', fallback: COMMISSION.name },
      { key: 'commission.address', label: 'Secretariat address', type: 'textarea', fallback: COMMISSION.address },
      { key: 'commission.email', label: 'Official email address', type: 'email', fallback: COMMISSION.email },
      { key: 'commission.phone', label: 'Telephone number', type: 'text', fallback: COMMISSION.phone },
      { key: 'commission.officeHours', label: 'Office hours', type: 'text', fallback: 'Monday to Friday, 8:00am – 4:00pm' },
    ],
  },
  {
    group: 'RECRUITMENT',
    label: 'Recruitment defaults',
    description: 'Applied when a new recruitment exercise is created.',
    fields: [
      { key: 'recruitment.maxApplicationsDefault', label: 'Default applications per applicant', type: 'number', fallback: '1' },
      { key: 'recruitment.examTotalMarks', label: 'Default examination total marks', type: 'number', fallback: '100' },
      { key: 'recruitment.examPassMark', label: 'Default examination pass mark', type: 'number', fallback: '50' },
      { key: 'recruitment.interviewSlotMinutes', label: 'Default minutes per interview', type: 'number', fallback: '20' },
      { key: 'recruitment.examWeight', label: 'Default examination weighting (%)', type: 'number', fallback: '50' },
      { key: 'recruitment.interviewWeight', label: 'Default interview weighting (%)', type: 'number', fallback: '50' },
    ],
  },
  {
    group: 'DOCUMENTS',
    label: 'Document handling',
    description: 'Limits applied to applicant document uploads.',
    fields: [
      { key: 'documents.maxSizeMb', label: 'Maximum document size (MB)', type: 'number', fallback: '8' },
      { key: 'documents.resubmissionDays', label: 'Days allowed for document correction', type: 'number', fallback: '7' },
    ],
  },
  {
    group: 'SECURITY',
    label: 'Security and access',
    description: 'Session and sign-in controls.',
    fields: [
      { key: 'security.maxFailedAttempts', label: 'Failed sign-ins before lock-out', type: 'number', fallback: '5' },
      { key: 'security.lockoutMinutes', label: 'Lock-out duration (minutes)', type: 'number', fallback: '15' },
      { key: 'security.sessionDays', label: 'Session lifetime (days)', type: 'number', fallback: '1' },
    ],
  },
  {
    group: 'NOTIFICATIONS',
    label: 'Notification settings',
    description: 'Default channels and sender identity.',
    fields: [
      { key: 'notifications.defaultChannel', label: 'Default channel (EMAIL, SMS or BOTH)', type: 'text', fallback: 'EMAIL' },
      { key: 'notifications.smsSenderId', label: 'SMS sender identity', type: 'text', fallback: 'KOGICSC' },
      { key: 'notifications.mailFrom', label: 'Email sender address', type: 'text', fallback: 'no-reply@kogicsc.kg.gov.ng' },
    ],
  },
  {
    group: 'DATA_PROTECTION',
    label: 'Data protection',
    description: 'Retention and lawful-basis settings determined by the Commission under the Nigeria Data Protection Act 2023.',
    fields: [
      { key: 'dataProtection.retentionMonths', label: 'Applicant record retention (months)', type: 'number', fallback: '60' },
      { key: 'dataProtection.lawfulBasis', label: 'Lawful basis for processing', type: 'text', fallback: 'Public interest and performance of a public task' },
      { key: 'dataProtection.collectGender', label: 'Collect and report gender statistics (yes or no)', type: 'text', fallback: 'yes' },
      { key: 'dataProtection.officerEmail', label: 'Data protection officer email', type: 'email', fallback: COMMISSION.email },
    ],
  },
] as const;

/** Module 5 / §7.5 - system configuration. */
export default async function SettingsPage() {
  await requirePagePermission(PERMISSIONS.SETTINGS_MANAGE);
  const [settings, dbStats] = await Promise.all([
    prisma.systemSetting.findMany(),
    Promise.all([
      prisma.user.count(),
      prisma.application.count(),
      prisma.applicantDocument.count(),
      prisma.auditLog.count(),
      prisma.notification.count(),
    ]),
  ]);
  const byKey = new Map(settings.map((s) => [s.key, s]));
  const [users, applications, documents, auditLogs, notifications] = dbStats;

  return (
    <>
      <PageHeading
        title="System Settings"
        description="Configuration applied across the portal. Every change is recorded in the audit trail."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {SETTING_GROUPS.map((group) => (
            <Card key={group.group}>
              <div className="card-header">
                <div>
                  <h2 className="card-title">{group.label}</h2>
                  <p className="mt-0.5 text-sm text-ink-500">{group.description}</p>
                </div>
              </div>
              <CardBody>
                <SettingsForm
                  group={group.group}
                  fields={group.fields.map((f) => ({
                    key: f.key,
                    label: f.label,
                    type: f.type,
                    value: byKey.get(f.key)?.value ?? f.fallback,
                  }))}
                />
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">System information</h2></div>
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Portal', value: `${COMMISSION.name} Portal` },
                  { label: 'Module set', value: 'Modules 1–8 (public content, recruitment, applicant dashboard, administration, users, reporting, notifications, audit)' },
                  { label: 'User accounts', value: users.toLocaleString('en-NG') },
                  { label: 'Applications on record', value: applications.toLocaleString('en-NG') },
                  { label: 'Documents stored', value: documents.toLocaleString('en-NG') },
                  { label: 'Audit records', value: auditLogs.toLocaleString('en-NG') },
                  { label: 'Notifications recorded', value: notifications.toLocaleString('en-NG') },
                  { label: 'Settings stored', value: settings.length },
                  { label: 'Checked', value: formatDateTime(new Date()) },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <div className="card-header"><h2 className="card-title">Availability monitoring</h2></div>
            <CardBody className="text-sm text-ink-700">
              <p>
                A health endpoint is available at <code className="rounded bg-ink-100 px-1">/api/health</code>{' '}
                for uptime monitoring. It reports database reachability and response latency.
              </p>
              <p className="mt-2 text-xs text-ink-500">
                Backup frequency, recovery objectives and hosting capacity are agreed during technical
                design and configured in the deployment environment.
              </p>
            </CardBody>
          </Card>

          <Card>
            <div className="card-header"><h2 className="card-title">Data protection</h2></div>
            <CardBody className="text-xs leading-relaxed text-ink-600">
              The Commission determines lawful processing bases, retention periods, access
              authorisations and privacy notices. Applicant personal information is not publicly
              accessible merely because it was submitted through the portal, and all access by
              officers is logged.
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
