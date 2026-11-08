/**
 * Role based access control (Module 5).
 * Users access only the functions and information assigned to their roles.
 */
import { ROLES, type Role } from './constants';

export const PERMISSIONS = {
  // Content (Module 1)
  CONTENT_VIEW: 'content.view',
  CONTENT_MANAGE: 'content.manage',
  CONTENT_PUBLISH: 'content.publish',
  ENQUIRY_MANAGE: 'enquiry.manage',
  // Exercises (Module 2.1)
  EXERCISE_VIEW: 'exercise.view',
  EXERCISE_MANAGE: 'exercise.manage',
  EXERCISE_APPROVE: 'exercise.approve',
  // Applications (Module 2.3)
  APPLICATION_VIEW: 'application.view',
  APPLICATION_MANAGE: 'application.manage',
  // Documents (Module 2.4)
  DOCUMENT_REVIEW: 'document.review',
  // Screening (Module 2.5)
  SCREENING_PERFORM: 'screening.perform',
  SCREENING_ASSIGN: 'screening.assign',
  SHORTLIST_PREPARE: 'shortlist.prepare',
  SHORTLIST_APPROVE: 'shortlist.approve',
  // Examination (Module 2.6)
  EXAM_MANAGE: 'exam.manage',
  EXAM_SCORE: 'exam.score',
  // Interview (Module 2.7)
  INTERVIEW_MANAGE: 'interview.manage',
  INTERVIEW_SCORE: 'interview.score',
  // Selection (Module 2.8)
  SELECTION_PREPARE: 'selection.prepare',
  SELECTION_APPROVE: 'selection.approve',
  // Reporting (Module 6)
  REPORT_VIEW: 'report.view',
  REPORT_EXPORT: 'report.export',
  // Notifications (Module 7)
  NOTIFICATION_SEND: 'notification.send',
  NOTIFICATION_APPROVE: 'notification.approve',
  // Users (Module 5)
  USER_VIEW: 'user.view',
  USER_MANAGE: 'user.manage',
  // Audit (Module 8)
  AUDIT_VIEW: 'audit.view',
  AUDIT_VIEW_SENSITIVE: 'audit.view.sensitive',
  // Administration (Module 4)
  ADMIN_RECORDS: 'admin.records',
  SETTINGS_MANAGE: 'settings.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;
const ALL = Object.values(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.SUPER_ADMIN]: ALL,
  [ROLES.COMMISSION_ADMIN]: [
    P.CONTENT_VIEW, P.CONTENT_MANAGE, P.CONTENT_PUBLISH, P.ENQUIRY_MANAGE,
    P.EXERCISE_VIEW, P.EXERCISE_MANAGE, P.EXERCISE_APPROVE,
    P.APPLICATION_VIEW, P.APPLICATION_MANAGE, P.DOCUMENT_REVIEW,
    P.SCREENING_PERFORM, P.SCREENING_ASSIGN, P.SHORTLIST_PREPARE, P.SHORTLIST_APPROVE,
    P.EXAM_MANAGE, P.EXAM_SCORE, P.INTERVIEW_MANAGE, P.INTERVIEW_SCORE,
    P.SELECTION_PREPARE, P.SELECTION_APPROVE,
    P.REPORT_VIEW, P.REPORT_EXPORT, P.NOTIFICATION_SEND, P.NOTIFICATION_APPROVE,
    P.USER_VIEW, P.USER_MANAGE, P.AUDIT_VIEW, P.AUDIT_VIEW_SENSITIVE,
    P.ADMIN_RECORDS, P.SETTINGS_MANAGE,
  ],
  [ROLES.RECRUITMENT_DIRECTOR]: [
    P.CONTENT_VIEW,
    P.EXERCISE_VIEW, P.EXERCISE_MANAGE, P.EXERCISE_APPROVE,
    P.APPLICATION_VIEW, P.APPLICATION_MANAGE,
    P.SCREENING_ASSIGN, P.SCREENING_PERFORM,
    P.SHORTLIST_PREPARE, P.SHORTLIST_APPROVE,
    P.EXAM_MANAGE, P.INTERVIEW_MANAGE,
    P.SELECTION_PREPARE, P.SELECTION_APPROVE,
    P.REPORT_VIEW, P.REPORT_EXPORT,
    P.NOTIFICATION_SEND, P.NOTIFICATION_APPROVE,
    P.DOCUMENT_REVIEW, P.AUDIT_VIEW, P.ADMIN_RECORDS,
  ],
  [ROLES.RECRUITMENT_OFFICER]: [
    P.CONTENT_VIEW, P.EXERCISE_VIEW, P.EXERCISE_MANAGE,
    P.APPLICATION_VIEW, P.APPLICATION_MANAGE,
    P.SCREENING_ASSIGN, P.SHORTLIST_PREPARE,
    P.EXAM_MANAGE, P.INTERVIEW_MANAGE, P.SELECTION_PREPARE,
    P.REPORT_VIEW, P.REPORT_EXPORT, P.NOTIFICATION_SEND, P.ADMIN_RECORDS,
  ],
  [ROLES.SCREENING_OFFICER]: [
    P.EXERCISE_VIEW, P.APPLICATION_VIEW,
    P.SCREENING_PERFORM, P.DOCUMENT_REVIEW, P.REPORT_VIEW,
  ],
  [ROLES.DOCUMENT_OFFICER]: [
    P.EXERCISE_VIEW, P.APPLICATION_VIEW, P.DOCUMENT_REVIEW, P.REPORT_VIEW,
  ],
  [ROLES.EXAMINATION_OFFICER]: [
    P.EXERCISE_VIEW, P.APPLICATION_VIEW,
    P.EXAM_MANAGE, P.EXAM_SCORE, P.REPORT_VIEW, P.NOTIFICATION_SEND,
  ],
  [ROLES.INTERVIEW_PANEL]: [
    P.EXERCISE_VIEW, P.APPLICATION_VIEW, P.INTERVIEW_SCORE,
  ],
  [ROLES.CONTENT_OFFICER]: [
    P.CONTENT_VIEW, P.CONTENT_MANAGE, P.ENQUIRY_MANAGE,
    P.EXERCISE_VIEW, P.NOTIFICATION_SEND,
  ],
  [ROLES.REPORTING_OFFICER]: [
    P.EXERCISE_VIEW, P.APPLICATION_VIEW, P.REPORT_VIEW, P.REPORT_EXPORT, P.AUDIT_VIEW,
  ],
  [ROLES.APPLICANT]: [],
};

export function permissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] ?? [];
}

export function roleHas(role: string, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

/** Effective permissions = role defaults + explicit per-user grants. */
export function effectivePermissions(role: string, extra: string[] = []): Permission[] {
  const set = new Set<string>(permissionsForRole(role));
  for (const e of extra) set.add(e);
  return Array.from(set) as Permission[];
}

export function hasPermission(
  user: { role: string; permissions?: string[] } | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return effectivePermissions(user.role, user.permissions ?? []).includes(permission);
}

export function hasAnyPermission(
  user: { role: string; permissions?: string[] } | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

export const PERMISSION_LABELS: Record<string, string> = {
  'content.view': 'View portal content',
  'content.manage': 'Create and edit portal content',
  'content.publish': 'Approve and publish content',
  'enquiry.manage': 'Manage public enquiries',
  'exercise.view': 'View recruitment exercises',
  'exercise.manage': 'Create and configure recruitment exercises',
  'exercise.approve': 'Approve recruitment exercises',
  'application.view': 'View applications',
  'application.manage': 'Manage applications',
  'document.review': 'Review and verify applicant documents',
  'screening.perform': 'Perform application screening',
  'screening.assign': 'Assign applications to screening officers',
  'shortlist.prepare': 'Prepare shortlists',
  'shortlist.approve': 'Approve shortlists',
  'exam.manage': 'Manage examinations, centres and candidates',
  'exam.score': 'Enter and validate examination scores',
  'interview.manage': 'Manage interview schedules and panels',
  'interview.score': 'Record interview scores',
  'selection.prepare': 'Prepare final selection lists',
  'selection.approve': 'Approve final selection lists',
  'report.view': 'View dashboards and reports',
  'report.export': 'Export reports (PDF / Excel / CSV)',
  'notification.send': 'Send notifications',
  'notification.approve': 'Approve notification batches',
  'user.view': 'View user accounts',
  'user.manage': 'Create and manage user accounts',
  'audit.view': 'View audit trail',
  'audit.view.sensitive': 'View sensitive audit records',
  'admin.records': 'Commission administrative records',
  'settings.manage': 'Manage system settings',
};
