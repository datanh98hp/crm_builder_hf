import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthUser } from '../auth/auth.types.js';
import { ANY_AUTHENTICATED, IS_PUBLIC, PERMISSION_KEY } from '../auth/decorators.js';
import { ErrorCode } from '../errors/error-codes.js';

const FORBIDDEN = () => new ForbiddenException({ code: ErrorCode.Forbidden, message: 'Bạn không có quyền truy cập tài nguyên này' });

/**
 * Default deny: a route is reachable only if it is @Public(), @AnyAuthenticatedUser(),
 * or @RequirePermission(code) and the caller holds that permission. A forgotten
 * decorator therefore fails closed instead of exposing the route to every account.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const user = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    if (!user) throw FORBIDDEN();
    const required = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, targets);
    if (required) {
      if (!user.grants[required]) throw FORBIDDEN();
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(ANY_AUTHENTICATED, targets)) return true;
    throw FORBIDDEN();
  }
}
