/**
 * Permission vocabulary shared by every module. A module adds its codes here, then maps them to roles
 * and data scopes in `modules/access-control/role-grants.ts`. Codes are `<resource>.<action>`.
 */
export const PERMISSIONS = {
  UsersManage: 'users.manage',
  AuditRead: 'audit.read',
  ApplicationsRead: 'applications.read',
  ApplicationsAssign: 'applications.assign',
  AdvisingMessageSend: 'advising.message.send',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
