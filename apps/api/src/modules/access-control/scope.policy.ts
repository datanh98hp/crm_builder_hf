import { AuthUser, DataScope } from '../../common/auth/auth.types.js';

const RANK: Record<DataScope, number> = { OWN: 1, ASSIGNED: 2, BRANCH: 3, ALL: 4 };

export function widest(a: DataScope | undefined, b: DataScope): DataScope {
  return !a || RANK[b] > RANK[a] ? b : a;
}

export interface ScopedResource {
  ownerId?: string | null;
  assigneeId?: string | null;
  branchId?: string | null;
}

/**
 * Resource-level check against the actual resource (prevents IDOR/BOLA).
 * Missing grant => deny. Scope BRANCH requires both sides to have a branch.
 */
export function canAccess(user: AuthUser, permission: string, resource: ScopedResource): boolean {
  const scope = user.grants[permission];
  if (!scope) return false;
  switch (scope) {
    case 'ALL':
      return true;
    case 'BRANCH':
      return !!user.branchId && user.branchId === resource.branchId;
    case 'ASSIGNED':
      return resource.assigneeId === user.id || resource.ownerId === user.id;
    case 'OWN':
      return resource.ownerId === user.id;
    default:
      return false;
  }
}
