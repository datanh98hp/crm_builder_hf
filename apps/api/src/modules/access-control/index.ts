// Public API of the access-control module. Other modules import only from here.
export { AccessControlModule } from './access-control.module.js';
export { AccessControlService } from './access-control.service.js';
export { canAccess, widest } from './scope.policy.js';
export type { ScopedResource } from './scope.policy.js';
export { ROLE_CODES, ROLE_GRANTS } from './role-grants.js';
export type { RoleCode } from './role-grants.js';
