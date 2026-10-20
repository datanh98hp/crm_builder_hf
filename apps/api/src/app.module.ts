import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard.js';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AccessControlModule } from './modules/access-control/index.js';
import { AuditModule } from './modules/audit/index.js';
import { AuthModule, JwtAuthGuard } from './modules/auth/index.js';
import { HealthModule } from './modules/health/health.module.js';
import { OutboxModule } from './modules/outbox/index.js';
import { RedisModule } from './redis/redis.module.js';

/** Composition root of the HTTP API. Background jobs live in `workers/worker.module.ts`. */
@Module({
  imports: [
    // infrastructure
    ConfigModule,
    DatabaseModule,
    RedisModule,
    RateLimitModule,
    // feature modules
    AccessControlModule,
    AuditModule,
    OutboxModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Request pipeline, in order: rate limit -> authenticate -> authorize (default deny).
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
