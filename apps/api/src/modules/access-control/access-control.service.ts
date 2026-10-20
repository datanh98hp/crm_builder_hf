import { Injectable } from '@nestjs/common';
import { AuthUser, DataScope } from '../../common/auth/auth.types.js';
import { PrismaService } from '../../database/prisma.service.js';
import { widest } from './scope.policy.js';

@Injectable()
export class AccessControlService {
  constructor(private prisma: PrismaService) {}

  async loadAuthUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!user || user.status !== 'ACTIVE') return null;
    const grants: Record<string, DataScope> = {};
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        grants[rp.permission.code] = widest(grants[rp.permission.code], rp.scope);
      }
    }
    return {
      id: user.id,
      email: user.email,
      branchId: user.branchId,
      roles: user.roles.map((r: { role: { code: string } }) => r.role.code),
      grants,
    };
  }
}
