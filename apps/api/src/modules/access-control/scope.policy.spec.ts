import { AuthUser } from '../../common/auth/auth.types.js';
import { canAccess, widest } from './scope.policy.js';

const user = (grants: AuthUser['grants'], over: Partial<AuthUser> = {}): AuthUser => ({
  id: 'u1',
  email: 'u@example.test',
  branchId: 'b1',
  roles: [],
  grants,
  ...over,
});
const P = 'applications.read';

describe('canAccess (data scope)', () => {
  it('denies when the permission is not granted at all', () => {
    expect(canAccess(user({}), P, { ownerId: 'u1' })).toBe(false);
  });
  it('OWN: only the owner (cross-customer access denied)', () => {
    const u = user({ [P]: 'OWN' });
    expect(canAccess(u, P, { ownerId: 'u1' })).toBe(true);
    expect(canAccess(u, P, { ownerId: 'u2' })).toBe(false);
    expect(canAccess(u, P, { assigneeId: 'u1', ownerId: 'u2' })).toBe(false);
  });
  it('ASSIGNED: assigned records only (unassigned denied)', () => {
    const u = user({ [P]: 'ASSIGNED' });
    expect(canAccess(u, P, { assigneeId: 'u1', ownerId: 'c1' })).toBe(true);
    expect(canAccess(u, P, { assigneeId: 'other', ownerId: 'c1' })).toBe(false);
    expect(canAccess(u, P, { assigneeId: null, ownerId: 'c1' })).toBe(false);
  });
  it('BRANCH: same branch only; user without a branch is denied (cross-branch denied)', () => {
    expect(canAccess(user({ [P]: 'BRANCH' }), P, { branchId: 'b1' })).toBe(true);
    expect(canAccess(user({ [P]: 'BRANCH' }), P, { branchId: 'b2' })).toBe(false);
    expect(canAccess(user({ [P]: 'BRANCH' }, { branchId: null }), P, { branchId: null })).toBe(false);
  });
  it('ALL: allowed only when explicitly granted', () => {
    expect(canAccess(user({ [P]: 'ALL' }), P, { ownerId: 'x', branchId: 'z' })).toBe(true);
  });
  it('widest() merges scopes across roles', () => {
    expect(widest(undefined, 'OWN')).toBe('OWN');
    expect(widest('OWN', 'BRANCH')).toBe('BRANCH');
    expect(widest('ALL', 'ASSIGNED')).toBe('ALL');
  });
});
