import Link from 'next/link';
import type { SessionUser } from '@/lib/auth';
import { hasAnyPermission, PERMISSIONS, type Permission } from '@/lib/rbac';

export interface NavItem {
  label: string;
  href: string;
  permissions: Permission[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const P = PERMISSIONS;

export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', permissions: [] },
      { label: 'Reports & Analytics', href: '/admin/reports', permissions: [P.REPORT_VIEW] },
      { label: 'Approvals', href: '/admin/approvals', permissions: [P.EXERCISE_APPROVE, P.SHORTLIST_APPROVE, P.SELECTION_APPROVE, P.CONTENT_PUBLISH, P.NOTIFICATION_APPROVE] },
    ],
  },
  {
    label: 'Recruitment',
    items: [
      { label: 'Recruitment Exercises', href: '/admin/exercises', permissions: [P.EXERCISE_VIEW] },
      { label: 'Applications', href: '/admin/applications', permissions: [P.APPLICATION_VIEW] },
      { label: 'Screening', href: '/admin/screening', permissions: [P.SCREENING_PERFORM, P.SCREENING_ASSIGN] },
      { label: 'Document Verification', href: '/admin/documents', permissions: [P.DOCUMENT_REVIEW] },
      { label: 'Shortlists', href: '/admin/shortlists', permissions: [P.SHORTLIST_PREPARE, P.SHORTLIST_APPROVE] },
      { label: 'Examinations', href: '/admin/examinations', permissions: [P.EXAM_MANAGE, P.EXAM_SCORE] },
      { label: 'Interviews', href: '/admin/interviews', permissions: [P.INTERVIEW_MANAGE, P.INTERVIEW_SCORE] },
      { label: 'Final Selection', href: '/admin/selection', permissions: [P.SELECTION_PREPARE, P.SELECTION_APPROVE] },
    ],
  },
  {
    label: 'Portal Content',
    items: [
      { label: 'News & Notices', href: '/admin/content', permissions: [P.CONTENT_VIEW] },
      { label: 'Institutional Pages', href: '/admin/content/pages', permissions: [P.CONTENT_MANAGE] },
      { label: 'Leadership', href: '/admin/content/leadership', permissions: [P.CONTENT_MANAGE] },
      { label: 'Departments & Units', href: '/admin/content/departments', permissions: [P.CONTENT_MANAGE] },
      { label: 'Downloads', href: '/admin/content/downloads', permissions: [P.CONTENT_MANAGE] },
      { label: 'FAQs', href: '/admin/content/faqs', permissions: [P.CONTENT_MANAGE] },
      { label: 'Public Enquiries', href: '/admin/enquiries', permissions: [P.ENQUIRY_MANAGE] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Internal Tasks', href: '/admin/records/tasks', permissions: [P.ADMIN_RECORDS] },
      { label: 'Correspondence', href: '/admin/records/correspondence', permissions: [P.ADMIN_RECORDS] },
      { label: 'Document Repository', href: '/admin/records/repository', permissions: [P.ADMIN_RECORDS] },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Notifications', href: '/admin/notifications', permissions: [P.NOTIFICATION_SEND] },
      { label: 'Message Templates', href: '/admin/notifications/templates', permissions: [P.NOTIFICATION_APPROVE] },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Users & Roles', href: '/admin/users', permissions: [P.USER_VIEW] },
      { label: 'Audit Trail', href: '/admin/audit', permissions: [P.AUDIT_VIEW] },
      { label: 'Settings', href: '/admin/settings', permissions: [P.SETTINGS_MANAGE] },
    ],
  },
];

/** Only the groups and items the signed-in officer's role permits. */
export function visibleNav(user: SessionUser): NavGroup[] {
  return ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.permissions.length === 0 || hasAnyPermission(user, item.permissions),
    ),
  })).filter((group) => group.items.length > 0);
}

export function AdminSidebar({ user, pathname }: { user: SessionUser; pathname?: string }) {
  const groups = visibleNav(user);
  return (
    <nav aria-label="Administration navigation" className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-kogi-300">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded px-3 py-1.5 text-[13px] transition ${
                      active
                        ? 'bg-kogi-700 font-semibold text-white'
                        : 'text-kogi-100 hover:bg-kogi-800 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
