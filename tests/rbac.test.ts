import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS, PERMISSION_LABELS, ROLE_PERMISSIONS, effectivePermissions,
  hasAnyPermission, hasPermission, permissionsForRole, roleHas,
} from '@/lib/rbac';
import { ROLES, ROLE_LABELS, STAFF_ROLES, type Role } from '@/lib/constants';

const P = PERMISSIONS;

describe('role catalogue (Module 5)', () => {
  it('defines the eleven user categories named in the proposal', () => {
    expect(Object.keys(ROLES)).toHaveLength(11);
    expect(STAFF_ROLES).toHaveLength(10);
    for (const role of Object.values(ROLES)) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it('labels every permission it defines', () => {
    for (const permission of Object.values(P)) {
      expect(PERMISSION_LABELS[permission], permission).toBeTruthy();
    }
  });
});

describe('super administrator', () => {
  const user = { role: ROLES.SUPER_ADMIN };

  it('holds every permission', () => {
    for (const permission of Object.values(P)) {
      expect(hasPermission(user, permission), permission).toBe(true);
    }
  });
});

describe('role separation of duties', () => {
  it('lets a screening officer screen but not approve a shortlist', () => {
    const user = { role: ROLES.SCREENING_OFFICER };
    expect(hasPermission(user, P.SCREENING_PERFORM)).toBe(true);
    expect(hasPermission(user, P.DOCUMENT_REVIEW)).toBe(true);
    expect(hasPermission(user, P.SHORTLIST_APPROVE)).toBe(false);
    expect(hasPermission(user, P.USER_MANAGE)).toBe(false);
    expect(hasPermission(user, P.SETTINGS_MANAGE)).toBe(false);
  });

  it('lets a recruitment officer prepare but not approve', () => {
    const user = { role: ROLES.RECRUITMENT_OFFICER };
    expect(hasPermission(user, P.EXERCISE_MANAGE)).toBe(true);
    expect(hasPermission(user, P.SHORTLIST_PREPARE)).toBe(true);
    expect(hasPermission(user, P.SELECTION_PREPARE)).toBe(true);
    expect(hasPermission(user, P.EXERCISE_APPROVE)).toBe(false);
    expect(hasPermission(user, P.SHORTLIST_APPROVE)).toBe(false);
    expect(hasPermission(user, P.SELECTION_APPROVE)).toBe(false);
  });

  it('lets a recruitment director approve each recruitment stage', () => {
    const user = { role: ROLES.RECRUITMENT_DIRECTOR };
    expect(hasPermission(user, P.EXERCISE_APPROVE)).toBe(true);
    expect(hasPermission(user, P.SHORTLIST_APPROVE)).toBe(true);
    expect(hasPermission(user, P.SELECTION_APPROVE)).toBe(true);
    expect(hasPermission(user, P.USER_MANAGE)).toBe(false);
  });

  it('restricts an interview panel member to scoring', () => {
    const user = { role: ROLES.INTERVIEW_PANEL };
    expect(hasPermission(user, P.INTERVIEW_SCORE)).toBe(true);
    expect(hasPermission(user, P.APPLICATION_VIEW)).toBe(true);
    expect(hasPermission(user, P.INTERVIEW_MANAGE)).toBe(false);
    expect(hasPermission(user, P.SCREENING_PERFORM)).toBe(false);
    expect(hasPermission(user, P.REPORT_EXPORT)).toBe(false);
  });

  it('restricts a content officer to portal content', () => {
    const user = { role: ROLES.CONTENT_OFFICER };
    expect(hasPermission(user, P.CONTENT_MANAGE)).toBe(true);
    expect(hasPermission(user, P.ENQUIRY_MANAGE)).toBe(true);
    expect(hasPermission(user, P.CONTENT_PUBLISH)).toBe(false);
    expect(hasPermission(user, P.APPLICATION_VIEW)).toBe(false);
  });

  it('gives a document officer document review without screening decisions', () => {
    const user = { role: ROLES.DOCUMENT_OFFICER };
    expect(hasPermission(user, P.DOCUMENT_REVIEW)).toBe(true);
    expect(hasPermission(user, P.SCREENING_PERFORM)).toBe(false);
  });

  it('gives an examination officer scoring rights but not interview management', () => {
    const user = { role: ROLES.EXAMINATION_OFFICER };
    expect(hasPermission(user, P.EXAM_MANAGE)).toBe(true);
    expect(hasPermission(user, P.EXAM_SCORE)).toBe(true);
    expect(hasPermission(user, P.INTERVIEW_MANAGE)).toBe(false);
    expect(hasPermission(user, P.SELECTION_APPROVE)).toBe(false);
  });

  it('gives a reporting officer read and export rights only', () => {
    const user = { role: ROLES.REPORTING_OFFICER };
    expect(hasPermission(user, P.REPORT_VIEW)).toBe(true);
    expect(hasPermission(user, P.REPORT_EXPORT)).toBe(true);
    expect(hasPermission(user, P.AUDIT_VIEW)).toBe(true);
    expect(hasPermission(user, P.APPLICATION_MANAGE)).toBe(false);
    expect(hasPermission(user, P.SCREENING_PERFORM)).toBe(false);
  });

  it('grants an applicant no administrative permission', () => {
    const user = { role: ROLES.APPLICANT };
    expect(permissionsForRole(ROLES.APPLICANT)).toEqual([]);
    for (const permission of Object.values(P)) {
      expect(hasPermission(user, permission), permission).toBe(false);
    }
  });

  it('restricts sensitive audit records to the roles granted them', () => {
    expect(roleHas(ROLES.COMMISSION_ADMIN, P.AUDIT_VIEW_SENSITIVE)).toBe(true);
    expect(roleHas(ROLES.REPORTING_OFFICER, P.AUDIT_VIEW_SENSITIVE)).toBe(false);
    expect(roleHas(ROLES.SCREENING_OFFICER, P.AUDIT_VIEW_SENSITIVE)).toBe(false);
  });
});

describe('per-user permission grants', () => {
  it('adds an explicit grant to the role defaults', () => {
    const user = { role: ROLES.SCREENING_OFFICER, permissions: [P.REPORT_EXPORT] };
    expect(hasPermission(user, P.REPORT_EXPORT)).toBe(true);
    expect(hasPermission(user, P.SCREENING_PERFORM)).toBe(true);
    expect(hasPermission(user, P.SELECTION_APPROVE)).toBe(false);
  });

  it('never duplicates a permission already held by the role', () => {
    const effective = effectivePermissions(ROLES.SCREENING_OFFICER, [P.SCREENING_PERFORM]);
    expect(effective.filter((p) => p === P.SCREENING_PERFORM)).toHaveLength(1);
  });

  it('matches when any of several permissions is held', () => {
    const user = { role: ROLES.DOCUMENT_OFFICER };
    expect(hasAnyPermission(user, [P.SCREENING_PERFORM, P.DOCUMENT_REVIEW])).toBe(true);
    expect(hasAnyPermission(user, [P.USER_MANAGE, P.SETTINGS_MANAGE])).toBe(false);
  });
});

describe('unauthenticated access', () => {
  it('denies every permission with no user', () => {
    for (const permission of Object.values(P)) {
      expect(hasPermission(null, permission), permission).toBe(false);
      expect(hasPermission(undefined, permission), permission).toBe(false);
    }
  });
});

describe('role coverage of the recruitment lifecycle', () => {
  it('assigns every permission to at least one staff role', () => {
    const covered = new Set<string>();
    for (const role of STAFF_ROLES) {
      for (const p of ROLE_PERMISSIONS[role as Role]) covered.add(p);
    }
    for (const permission of Object.values(P)) {
      expect(covered.has(permission), `${permission} is held by no role`).toBe(true);
    }
  });
});
