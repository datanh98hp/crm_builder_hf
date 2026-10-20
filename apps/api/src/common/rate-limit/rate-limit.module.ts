import { Global, Module } from '@nestjs/common';
import { REDIS, RedisClient } from '../../redis/redis.module.js';
import { FallbackRateLimitStore } from './fallback-rate-limit.store.js';
import { MemoryRateLimitStore } from './memory-rate-limit.store.js';
import { RATE_LIMIT_STORE, RateLimitStore } from './rate-limit.store.js';
import { RedisRateLimitStore } from './redis-rate-limit.store.js';

@Global()
@Module({
  providers: [
    {
      provide: RATE_LIMIT_STORE,
      inject: [REDIS],
      useFactory: (redis: RedisClient): RateLimitStore =>
        redis ? new FallbackRateLimitStore(new RedisRateLimitStore(redis), new MemoryRateLimitStore()) : new MemoryRateLimitStore(),
    },
  ],
  exports: [RATE_LIMIT_STORE],
})
export class RateLimitModule {}
