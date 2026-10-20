import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AccessTokenPayload } from '../../common/auth/auth.types.js';
import { IS_PUBLIC } from '../../common/auth/decorators.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { AccessControlService } from '../access-control/index.js';

const UNAUTHENTICATED = () =>
  new UnauthorizedException({ code: ErrorCode.Unauthenticated, message: 'Chưa đăng nhập hoặc phiên đã hết hạn' });

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private access: AccessControlService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const [scheme, token] = (req.header('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw UNAUTHENTICATED();
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      // Permissions are loaded per request so disabling a user or changing roles takes effect immediately.
      const user = await this.access.loadAuthUser(payload.sub);
      if (!user) throw UNAUTHENTICATED();
      req.user = user;
      return true;
    } catch {
      throw UNAUTHENTICATED();
    }
  }
}
