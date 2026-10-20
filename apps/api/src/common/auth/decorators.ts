import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from './auth.types.js';
import { PermissionCode } from './permissions.js';

export const IS_PUBLIC = 'isPublic';
export const PERMISSION_KEY = 'requiredPermission';
export const ANY_AUTHENTICATED = 'anyAuthenticated';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const RequirePermission = (code: PermissionCode) => SetMetadata(PERMISSION_KEY, code);
/** Explicit opt-in for routes any signed-in user may call. Routes with no marker are denied. */
export const AnyAuthenticatedUser = () => SetMetadata(ANY_AUTHENTICATED, true);

export const CurrentUser = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user,
);
