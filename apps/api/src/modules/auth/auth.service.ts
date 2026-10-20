import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { RATE_LIMIT_STORE, RateLimitStore } from '../../common/rate-limit/rate-limit.store.js';
import { AppConfig } from '../../config/app-config.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/index.js';
import { hashPassword, verifyPassword } from './password.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

const DAY_MS = 86_400_000;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const invalidCredentials = () =>
  new UnauthorizedException({ code: ErrorCode.InvalidCredentials, message: 'Email hoặc mật khẩu không đúng' });
const invalidRefreshToken = () =>
  new UnauthorizedException({ code: ErrorCode.InvalidRefreshToken, message: 'Phiên đăng nhập không hợp lệ' });
const accountLocked = () =>
  new HttpException(
    { code: ErrorCode.RateLimited, message: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau' },
    HttpStatus.TOO_MANY_REQUESTS,
  );

@Injectable()
export class AuthService {
  /** Used to keep login timing similar when the email does not exist. */
  private readonly dummyHash = hashPassword(randomBytes(8).toString('hex'));

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
    @Inject(RATE_LIMIT_STORE) private limits: RateLimitStore,
    @Inject(APP_CONFIG) private config: AppConfig,
  ) {}

  async login(email: string, password: string, correlationId?: string): Promise<TokenPair> {
    const normalized = email.toLowerCase();
    const lockKey = `lockout:${normalized}`;
    const { limit, windowMs } = this.config.accountLockout;

    // Applies to any submitted email (existing or not), so it reveals nothing about which accounts exist.
    if ((await this.limits.peek(lockKey)) >= limit) {
      await this.audit.record({ action: 'auth.login_blocked', outcome: 'DENIED', correlationId });
      throw accountLocked();
    }

    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !passwordOk || user.status !== 'ACTIVE') {
      await this.limits.hit(lockKey, windowMs);
      await this.audit.record({ actorId: user?.id, action: 'auth.login', outcome: 'FAILURE', correlationId });
      throw invalidCredentials();
    }

    await this.limits.reset(lockKey);
    const tokens = await this.issueTokens(user.id, randomUUID());
    await this.audit.record({ actorId: user.id, action: 'auth.login', outcome: 'SUCCESS', correlationId });
    return tokens;
  }

  /** Rotation with reuse detection: replaying a rotated token revokes the whole family. */
  async refresh(token: string, correlationId?: string): Promise<TokenPair> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    if (!row || row.expiresAt < new Date() || row.user.status !== 'ACTIVE') throw invalidRefreshToken();

    const claimed = await this.prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (claimed.count === 0) {
      await this.revokeFamily(row.familyId);
      await this.audit.record({ actorId: row.userId, action: 'auth.refresh_reuse_detected', outcome: 'DENIED', correlationId });
      throw invalidRefreshToken();
    }
    return this.issueTokens(row.userId, row.familyId, row.id);
  }

  async logout(token: string, correlationId?: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row) return; // idempotent
    await this.revokeFamily(row.familyId);
    await this.audit.record({ actorId: row.userId, action: 'auth.logout', outcome: 'SUCCESS', correlationId });
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async issueTokens(userId: string, familyId: string, previousId?: string): Promise<TokenPair> {
    const refreshToken = randomBytes(48).toString('base64url');
    const created = await this.prisma.refreshToken.create({
      data: { userId, familyId, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + this.config.refreshTtlDays * DAY_MS) },
    });
    if (previousId) await this.prisma.refreshToken.update({ where: { id: previousId }, data: { replacedBy: created.id } });
    const accessToken = await this.jwt.signAsync({ sub: userId }, { expiresIn: this.config.accessTtlSeconds });
    return { accessToken, refreshToken, expiresIn: this.config.accessTtlSeconds, tokenType: 'Bearer' };
  }
}
