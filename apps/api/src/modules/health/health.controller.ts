import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../database/prisma.service.js';
import { REDIS, RedisClient } from '../../redis/redis.module.js';

const CHECK_TIMEOUT_MS = 2_000;

const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS).unref())]);

@ApiExcludeController()
@Public()
@Controller()
export class HealthController {
  constructor(
    private prisma: PrismaService,
    @Inject(REDIS) private redis: RedisClient,
  ) {}

  /** Liveness: the process is up. Never touches dependencies. */
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies this instance needs are reachable. */
  @Get('ready')
  async ready() {
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`);
      if (this.redis) await withTimeout(this.redis.ping());
      return { status: 'ready' };
    } catch {
      // No configuration or connection details in the response.
      throw new ServiceUnavailableException({ code: ErrorCode.NotReady, message: 'Dependency unavailable' });
    }
  }
}
