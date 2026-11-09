import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS, PERMISSION_LABELS, ROLE_PERMISSIONS, effectivePermissions,
  hasAnyPermission, hasPermission, permissionsForRole, roleHas,
} from '@/lib/rbac';
import { ROLES, ROLE_LABELS, STAFF_ROLES, type Role } from '@/lib/constants';
import { visibleNav } from '@/components/admin-nav';

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

describe('establishment, unit and examination-setting permissions', () => {
  it('lets the recruitment director maintain the register and the unit', () => {
    const user = { role: ROLES.RECRUITMENT_DIRECTOR };
    expect(hasPermission(user, PERMISSIONS.MDA_VIEW)).toBe(true);
    expect(hasPermission(user, PERMISSIONS.MDA_MANAGE)).toBe(true);
    expect(hasPermission(user, PERMISSIONS.UNIT_MANAGE)).toBe(true);
    expect(hasPermission(user, PERMISSIONS.EXAM_SET)).toBe(true);
  });

  it('lets a recruitment officer maintain MDAs but not the unit’s membership', () => {
    const user = { role: ROLES.RECRUITMENT_OFFICER };
    expect(hasPermission(user, PERMISSIONS.MDA_MANAGE)).toBe(true);
    expect(hasPermission(user, PERMISSIONS.UNIT_MANAGE)).toBe(false);
  });

  it('lets the examination officer set papers but not amend the register', () => {
    const user = { role: ROLES.EXAMINATION_OFFICER };
    expect(hasPermission(user, PERMISSIONS.EXAM_SET)).toBe(true);
    expect(hasPermission(user, PERMISSIONS.MDA_VIEW)).toBe(true);
    expect(hasPermission(user, PERMISSIONS.MDA_MANAGE)).toBe(false);
    expect(hasPermission(user, PERMISSIONS.UNIT_MANAGE)).toBe(false);
  });

  it('keeps question setting away from screening and interview roles', () => {
    for (const role of [ROLES.SCREENING_OFFICER, ROLES.DOCUMENT_OFFICER, ROLES.INTERVIEW_PANEL, ROLES.CONTENT_OFFICER]) {
      expect(hasPermission({ role }, PERMISSIONS.EXAM_SET), `${role} can set examinations`).toBe(false);
      expect(hasPermission({ role }, PERMISSIONS.MDA_MANAGE), `${role} can amend the register`).toBe(false);
      expect(hasPermission({ role }, PERMISSIONS.UNIT_MANAGE), `${role} can manage the unit`).toBe(false);
    }
  });

  it('lets the reporting officer read the register without amending it', () => {
    const user = { role: ROLES.REPORTING_OFFICER };
    expect(hasPermission(user, PERMISSIONS.MDA_VIEW)).toBe(true);
    expect(hasPermission(user, PERMISSIONS.MDA_MANAGE)).toBe(false);
  });

  it('gives an applicant none of these permissions', () => {
    for (const p of [PERMISSIONS.MDA_VIEW, PERMISSIONS.MDA_MANAGE, PERMISSIONS.UNIT_MANAGE, PERMISSIONS.EXAM_SET]) {
      expect(hasPermission({ role: ROLES.APPLICANT }, p)).toBe(false);
    }
  });

  it('labels every new permission for the user-permissions screen', () => {
    for (const p of [PERMISSIONS.MDA_VIEW, PERMISSIONS.MDA_MANAGE, PERMISSIONS.UNIT_MANAGE, PERMISSIONS.EXAM_SET]) {
      expect(PERMISSION_LABELS[p], `${p} has no label`).toBeTruthy();
    }
  });
});

describe('the new navigation groups', () => {
  it('shows the establishment group to the recruitment director', () => {
    const groups = visibleNav({ id: 'u', fullName: 'Director', email: 'd@x', role: ROLES.RECRUITMENT_DIRECTOR, permissions: [] } as never);
    const labels = groups.map((g) => g.label);
    expect(labels).toContain('Establishment');
    expect(labels).toContain('Examinations & Tests');
  });

  it('hides both groups from an interview panel member', () => {
    const groups = visibleNav({ id: 'u', fullName: 'Panel', email: 'p@x', role: ROLES.INTERVIEW_PANEL, permissions: [] } as never);
    const labels = groups.map((g) => g.label);
    expect(labels).not.toContain('Establishment');
  });
});
