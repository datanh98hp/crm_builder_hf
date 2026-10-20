import { loadConfig } from './app-config.js';

const base = { DATABASE_URL: 'postgresql://x', JWT_ACCESS_SECRET: 'a'.repeat(40) };
const prod = { ...base, NODE_ENV: 'production', REDIS_URL: 'redis://localhost:6379' };

describe('loadConfig', () => {
  it('accepts a valid environment and applies defaults', () => {
    const c = loadConfig(base);
    expect(c.port).toBe(3000);
    expect(c.accessTtlSeconds).toBe(900);
    expect(c.rateLimits.login).toEqual({ limit: 5, windowMs: 60_000 });
    expect(c.accountLockout).toEqual({ limit: 10, windowMs: 900_000 });
    expect(c.redisUrl).toBeUndefined();
  });

  it('reports every missing or invalid value at once', () => {
    const message = (() => {
      try {
        loadConfig({});
      } catch (error) {
        return (error as Error).message;
      }
      return '';
    })();
    expect(message).toContain('DATABASE_URL is required');
    expect(message).toContain('JWT_ACCESS_SECRET is required');
  });

  it('rejects short secrets and the example secret in production', () => {
    expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/at least 32/);
    expect(() => loadConfig({ ...prod, JWT_ACCESS_SECRET: `change-me-${'a'.repeat(30)}` })).toThrow(/example value/);
  });

  it('requires Redis in production so limits hold across replicas', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/REDIS_URL is required/);
    expect(loadConfig(prod).redisUrl).toBe('redis://localhost:6379');
  });

  it('rejects malformed numeric settings', () => {
    expect(() => loadConfig({ ...base, LOGIN_RATE_LIMIT: 'abc' })).toThrow(/LOGIN_RATE_LIMIT must be a non-negative integer/);
    expect(() => loadConfig({ ...base, PORT: '-1' })).toThrow(/PORT/);
  });

  it('disables API docs in production unless explicitly enabled', () => {
    expect(loadConfig(prod).enableApiDocs).toBe(false);
    expect(loadConfig({ ...prod, ENABLE_API_DOCS: 'true' }).enableApiDocs).toBe(true);
    expect(loadConfig(base).enableApiDocs).toBe(true);
  });
});
