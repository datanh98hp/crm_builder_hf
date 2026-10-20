import type { Redis } from 'ioredis';
import { RateLimitState, RateLimitStore } from './rate-limit.store.js';

// Atomic INCR + expiry. Also repairs a counter that lost its TTL, so a key can never become permanent.
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {count, ttl}
`;

/** Shared across replicas: limits and lockouts hold no matter which instance serves the request. */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private redis: Redis,
    private prefix = 'rl:',
  ) {}

  async hit(key: string, windowMs: number): Promise<RateLimitState> {
    const [count, ttl] = (await this.redis.eval(HIT_SCRIPT, 1, this.prefix + key, windowMs)) as [number, number];
    return { count, resetAt: Date.now() + ttl };
  }

  async peek(key: string): Promise<number> {
    return Number((await this.redis.get(this.prefix + key)) ?? 0);
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(this.prefix + key);
  }
}
