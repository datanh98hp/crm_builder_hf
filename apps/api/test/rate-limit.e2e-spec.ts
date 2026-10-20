import request from 'supertest';
import { clearRateLimitKeys, createTestApp, TestApp } from './helpers/app.js';

describe('login rate limit (e2e)', () => {
  let t: TestApp;
  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '3';
    await clearRateLimitKeys();
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });

  it('allows 3 attempts then returns 429 with the error envelope and Retry-After', async () => {
    const attempt = () => request(t.http()).post('/api/v1/auth/login').send({ email: 'burst@example.test', password: 'wrong-password-1' });
    for (let i = 0; i < 3; i++) await attempt().expect(401);
    const res = await attempt().expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});
