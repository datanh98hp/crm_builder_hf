import { DataScope } from '../../common/auth/auth.types.js';
import { PERMISSIONS as P, PermissionCode } from '../../common/auth/permissions.js';

export const ROLE_CODES = ['OPERATOR', 'ADMIN', 'MANAGE', 'ADVISING', 'CUSTOMER'] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

/**
 * Minimal placeholder matrix so local environments work. The official role/permission matrix is an
 * open decision (brief §12); a role never implies "all permissions".
 */
export const ROLE_GRANTS: Record<RoleCode, Partial<Record<PermissionCode, DataScope>>> = {
  OPERATOR: { [P.AuditRead]: 'ALL' },
  ADMIN: { [P.UsersManage]: 'ALL', [P.AuditRead]: 'ALL' },
  MANAGE: { [P.ApplicationsRead]: 'BRANCH', [P.ApplicationsAssign]: 'BRANCH' },
  ADVISING: { [P.ApplicationsRead]: 'ASSIGNED', [P.AdvisingMessageSend]: 'ASSIGNED' },
  CUSTOMER: { [P.ApplicationsRead]: 'OWN', [P.AdvisingMessageSend]: 'OWN' },
};
