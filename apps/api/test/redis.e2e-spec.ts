import { Redis } from 'ioredis';
import request from 'supertest';
import { FallbackRateLimitStore } from '../src/common/rate-limit/fallback-rate-limit.store.js';
import { MemoryRateLimitStore } from '../src/common/rate-limit/memory-rate-limit.store.js';
import { RedisRateLimitStore } from '../src/common/rate-limit/redis-rate-limit.store.js';
import { clearRateLimitKeys, createTestApp, redisUrl } from './helpers/app.js';
import { ensureUser, login } from './helpers/users.js';

const url = redisUrl();
const describeWithRedis = url ? describe : describe.skip;
if (!url) console.warn('REDIS_URL is not set: Redis integration tests are skipped. CI always runs them.');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describeWithRedis('RedisRateLimitStore (real Redis)', () => {
  let redis: Redis;
  let store: RedisRateLimitStore;

  beforeAll(async () => {
    redis = new Redis(url as string);
    await clearRateLimitKeys();
    store = new RedisRateLimitStore(redis);
  });
  afterAll(async () => {
    await redis.quit();
  });

  it('counts per key and isolates keys', async () => {
    expect((await store.hit('t:a', 60_000)).count).toBe(1);
    expect((await store.hit('t:a', 60_000)).count).toBe(2);
    expect((await store.hit('t:b', 60_000)).count).toBe(1);
  });

  it('is atomic under concurrency', async () => {
    const results = await Promise.all(Array.from({ length: 50 }, () => store.hit('t:concurrent', 60_000)));
    expect(new Set(results.map((r) => r.count)).size).toBe(50);
    expect(await store.peek('t:concurrent')).toBe(50);
  });

  it('always sets an expiry and reports when the window resets', async () => {
    const { resetAt } = await store.hit('t:ttl', 5_000);
    expect(resetAt).toBeGreaterThan(Date.now());
    expect(resetAt).toBeLessThanOrEqual(Date.now() + 5_000);
    expect(await redis.pttl('rl:t:ttl')).toBeGreaterThan(0);
  });

  it('starts a new window after expiry', async () => {
    await store.hit('t:expire', 200);
    await sleep(300);
    expect(await store.peek('t:expire')).toBe(0);
    expect((await store.hit('t:expire', 200)).count).toBe(1);
  });

  it('peek does not count and reset clears', async () => {
    await store.hit('t:peek', 60_000);
    expect(await store.peek('t:peek')).toBe(1);
    expect(await store.peek('t:peek')).toBe(1);
    await store.reset('t:peek');
    expect(await store.peek('t:peek')).toBe(0);
  });
});

describeWithRedis('Redis outage behaviour', () => {
  it('FallbackRateLimitStore keeps limiting when Redis is unreachable', async () => {
    const dead = new Redis('redis://127.0.0.1:6399', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    dead.on('error', () => undefined);
    const store = new FallbackRateLimitStore(new RedisRateLimitStore(dead), new MemoryRateLimitStore());
    expect((await store.hit('k', 60_000)).count).toBe(1);
    expect((await store.hit('k', 60_000)).count).toBe(2);
    dead.disconnect();
  });

  it('the API stays usable and limits still apply, but /ready reports not ready', async () => {
    const original = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://127.0.0.1:6399';
    process.env.LOGIN_RATE_LIMIT = '1000';
    process.env.ACCOUNT_LOGIN_LIMIT = '2';
    const t = await createTestApp();
    process.env.REDIS_URL = original;
    try {
      await ensureUser(t.prisma, 'e2e-outage@example.test');
      await login(t.http, 'e2e-outage@example.test').expect(200);
      await login(t.http, 'e2e-outage@example.test', 'wrong-password-1').expect(401);
      await login(t.http, 'e2e-outage@example.test', 'wrong-password-1').expect(401);
      await login(t.http, 'e2e-outage@example.test').expect(429); // lockout still enforced via the fallback
      const ready = await request(t.http()).get('/ready').expect(503);
      expect(ready.body.error.code).toBe('NOT_READY');
      await request(t.http()).get('/health').expect(200);
    } finally {
      await t.app.close();
    }
  });
});
