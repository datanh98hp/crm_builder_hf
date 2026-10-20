import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

const DAY_MS = 86_400_000;

@Injectable()
export class RefreshTokenCleanupService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /**
   * Deletes refresh tokens that expired more than `graceMs` ago. Expired tokens can no longer be used
   * or replayed. Revoked-but-unexpired rows are kept on purpose: reuse detection needs them to find
   * the token family of a replayed token.
   */
  async purgeExpired(now: Date = new Date(), graceMs = DAY_MS): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - graceMs) } } });
    return count;
  }
}
