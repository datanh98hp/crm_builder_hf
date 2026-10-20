import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Server } from 'node:http';
import { DataScope } from '../../src/common/auth/auth.types.js';
import { PermissionCode } from '../../src/common/auth/permissions.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { hashPassword } from '../../src/modules/auth/password.js';

export const PASSWORD = 'E2e-Password-1!';

export async function ensureUser(
  prisma: PrismaService,
  email: string,
  options: { status?: 'ACTIVE' | 'DISABLED'; password?: string } = {},
) {
  const status = options.status ?? 'ACTIVE';
  const passwordHash = await hashPassword(options.password ?? PASSWORD);
  // Reset the password on every call so reruns against a persistent database stay deterministic.
  return prisma.user.upsert({
    where: { email },
    update: { status, passwordHash },
    create: { email, fullName: 'E2E', status, passwordHash },
  });
}

/** Gives the user a dedicated role holding exactly the given permissions. */
export async function grantPermissions(prisma: PrismaService, userId: string, permissions: Partial<Record<PermissionCode, DataScope>>) {
  const role = await prisma.role.create({ data: { code: `E2E_${randomUUID()}`, name: 'e2e' } });
  for (const [code, scope] of Object.entries(permissions) as [PermissionCode, DataScope][]) {
    const permission = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id, scope } });
  }
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}

export const login = (http: () => Server, email: string, password = PASSWORD) =>
  request(http()).post('/api/v1/auth/login').send({ email, password });
