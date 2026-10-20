import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AppConfig, RateLimitPolicyName } from '../../config/app-config.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { ErrorCode } from '../errors/error-codes.js';
import { RATE_LIMIT_STORE, RateLimitStore } from './rate-limit.store.js';

const RATE_LIMIT_KEY = 'rateLimitPolicy';

/** Selects a named policy from configuration (`AppConfig.rateLimits`). Routes without it use `default`. */
export const RateLimit = (policy: RateLimitPolicyName) => SetMetadata(RATE_LIMIT_KEY, policy);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(RATE_LIMIT_STORE) private store: RateLimitStore,
    @Inject(APP_CONFIG) private config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const policyName =
      this.reflector.getAllAndOverride<RateLimitPolicyName | undefined>(RATE_LIMIT_KEY, [ctx.getHandler(), ctx.getClass()]) ?? 'default';
    const { limit, windowMs } = this.config.rateLimits[policyName];
    const http = ctx.switchToHttp();
    // req.ip honours the "trust proxy" setting, so it is the client address behind Caddy.
    const key = `${policyName}:${http.getRequest<Request>().ip}:${ctx.getClass().name}.${ctx.getHandler().name}`;
    const { count, resetAt } = await this.store.hit(key, windowMs);
    if (count <= limit) return true;
    http.getResponse<Response>().setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))));
    throw new HttpException(
      { code: ErrorCode.RateLimited, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
