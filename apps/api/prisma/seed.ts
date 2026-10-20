import { existsSync } from 'node:fs';
// Synthetic local data only. Never run against production without SEED_ADMIN_* set.
import { PrismaClient } from '@prisma/client';

for (const envPath of ['.env', '../../.env', '../.env']) {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
    break;
  }
}
import { PERMISSIONS } from '../src/common/auth/permissions.js';
import { createAdapter } from '../src/database/prisma.service.js';
import { ROLE_GRANTS } from '../src/modules/access-control/index.js';
import { hashPassword } from '../src/modules/auth/password.js';

const prisma = new PrismaClient({ adapter: createAdapter(process.env.DATABASE_URL ?? '') });

function seedCredentials() {
  const isProd = process.env.NODE_ENV === 'production';
  const email = (process.env.SEED_ADMIN_EMAIL ?? (isProd ? '' : 'admin@example.test')).toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? (isProd ? '' : 'ChangeMe-Local-1!');
  if (isProd && !email) throw new Error('Refusing to seed in production: set SEED_ADMIN_EMAIL.');
  if (isProd && password.length < 12) throw new Error('Refusing to seed in production: set SEED_ADMIN_PASSWORD (>= 12 chars).');
  return { email, password };
}

async function seedRolesAndPermissions() {
  for (const code of Object.values(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
  }
  for (const [roleCode, grants] of Object.entries(ROLE_GRANTS)) {
    const role = await prisma.role.upsert({ where: { code: roleCode }, update: {}, create: { code: roleCode, name: roleCode } });
    for (const [permissionCode, scope] of Object.entries(grants)) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code: permissionCode } });
      const roleId_permissionId = { roleId: role.id, permissionId: permission.id };
      await prisma.rolePermission.upsert({ where: { roleId_permissionId }, update: { scope }, create: { ...roleId_permissionId, scope } });
    }
  }
}

async function seedAdmin({ email, password }: { email: string; password: string }) {
  const branch = await prisma.branch.upsert({ where: { code: 'HQ' }, update: {}, create: { code: 'HQ', name: 'Head Office (synthetic)' } });
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, fullName: 'Local Admin', passwordHash: await hashPassword(password), branchId: branch.id },
  });
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const userId_roleId = { userId: admin.id, roleId: role.id };
  await prisma.userRole.upsert({ where: { userId_roleId }, update: {}, create: userId_roleId });
}

async function main() {
  const credentials = seedCredentials();
  await seedRolesAndPermissions();
  await seedAdmin(credentials);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Seed failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
