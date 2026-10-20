/** Mirrors the Prisma `DataScope` enum; kept local so policies are testable without the generated client. */
export type DataScope = 'OWN' | 'ASSIGNED' | 'BRANCH' | 'ALL';

export interface AuthUser {
  id: string;
  email: string;
  branchId: string | null;
  roles: string[];
  /** permission code -> widest scope granted across the user's roles */
  grants: Record<string, DataScope>;
}

export interface AccessTokenPayload {
  sub: string;
}
