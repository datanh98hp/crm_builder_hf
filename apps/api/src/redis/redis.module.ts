import { Global, Inject, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/config.module.js';

export const REDIS = Symbol('REDIS');

/** `null` when REDIS_URL is not configured (local development / unit tests). */
export type RedisClient = Redis | null;

const STARTUP_WAIT_MS = 3_000;

function waitUntilReady(client: Redis, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (client.status === 'ready') return resolve();
    const timer = setTimeout(resolve, timeoutMs);
    timer.unref();
    client.once('ready', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

@Injectable()
class RedisLifecycle implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private redis: RedisClient) {}
  async onApplicationShutdown() {
    if (this.redis && this.redis.status !== 'end') await this.redis.quit().catch(() => this.redis?.disconnect());
  }
}

/**
 * Shared command client. Commands fail fast while Redis is down (no offline queue) so callers
 * can degrade deliberately instead of hanging requests. BullMQ uses its own connections.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: async (cfg: AppConfig): Promise<RedisClient> => {
        if (!cfg.redisUrl) return null;
        const logger = new Logger('Redis');
        const client = new Redis(cfg.redisUrl, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          retryStrategy: (n) => Math.min(n * 200, 2000),
        });
        client.on('error', (e: Error) => logger.warn(`Redis error: ${e.message}`));
        // Without an offline queue, commands sent before the socket is ready would fail, so wait briefly.
        // If Redis stays down the app still starts; the rate-limit fallback and /ready cover that case.
        await waitUntilReady(client, STARTUP_WAIT_MS);
        return client;
      },
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}
