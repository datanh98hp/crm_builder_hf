import request from 'supertest';
import { clearRateLimitKeys, createTestApp, redisUrl, TestApp } from './helpers/app.js';
import { ensureUser, login } from './helpers/users.js';

const describeWithRedis = redisUrl() ? describe : describe.skip;

describeWithRedis('limits are shared across API replicas (real Redis)', () => {
  let a: TestApp;
  let b: TestApp;

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000'; // isolate the account lockout from the per-IP login limit
    process.env.ACCOUNT_LOGIN_LIMIT = '3';
    process.env.REFRESH_RATE_LIMIT = '3';
    await clearRateLimitKeys();
    a = await createTestApp();
    b = await createTestApp();
  });
  afterAll(async () => {
    await a.app.close();
    await b.app.close();
  });

  it('an account locked by failures spread over replicas A and B is locked on both', async () => {
    const email = 'e2e-replicas@example.test';
    await ensureUser(a.prisma, email);
    await login(a.http, email, 'wrong-password-1').expect(401);
    await login(b.http, email, 'wrong-password-1').expect(401);
    await login(a.http, email, 'wrong-password-1').expect(401);
    await login(b.http, email).expect(429);
    await login(a.http, email).expect(429);
  });

  it('the per-IP route limit counts requests from both replicas together', async () => {
    const attempt = (t: TestApp) =>
      request(t.http())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'x'.repeat(40) });
    await attempt(a).expect(401);
    await attempt(b).expect(401);
    await attempt(a).expect(401);
    await attempt(b).expect(429);
  });
});
