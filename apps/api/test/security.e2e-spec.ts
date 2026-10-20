import { Controller, Get } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { JWT_AUDIENCE, JWT_ISSUER } from '../src/modules/auth/auth.constants.js';
import { clearRateLimitKeys, createTestApp, TestApp } from './helpers/app.js';
import { ensureUser, login, PASSWORD } from './helpers/users.js';

process.env.LOGIN_RATE_LIMIT = '1000';
process.env.ACCOUNT_LOGIN_LIMIT = '3';

@Controller('sec-test')
class UnmarkedController {
  @Get('forgotten') forgotten() {
    return { secret: true };
  } // no permission marker on purpose
}

const EMAIL = 'e2e-sec@example.test';
const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const claims = (sub: string) => ({ sub, iss: JWT_ISSUER, aud: JWT_AUDIENCE });

describe('security (e2e, real PostgreSQL)', () => {
  let t: TestApp;
  let userId: string;

  beforeAll(async () => {
    await clearRateLimitKeys();
    t = await createTestApp({ controllers: [UnmarkedController] });
    userId = (await ensureUser(t.prisma, EMAIL)).id;
  });
  afterAll(async () => {
    await t.app.close();
  });

  const me = (token: string) => request(t.http()).get('/api/v1/auth/me').set('authorization', `Bearer ${token}`);

  it('default-deny: an authenticated user cannot reach a route with no permission marker', async () => {
    const token = (await login(t.http, EMAIL).expect(200)).body.data.accessToken;
    const res = await request(t.http()).get('/api/v1/sec-test/forgotten').set('authorization', `Bearer ${token}`).expect(403);
    expect(res.body.error.code).toBe('RESOURCE_FORBIDDEN');
    await request(t.http()).get('/api/v1/sec-test/forgotten').expect(401);
  });

  it('rejects tokens with a wrong issuer or audience even with a valid signature', async () => {
    const foreign = new JwtService({ secret: process.env.JWT_ACCESS_SECRET });
    await me(await foreign.signAsync({ sub: userId }, { expiresIn: 60, issuer: 'someone-else', audience: JWT_AUDIENCE })).expect(401);
    await me(await foreign.signAsync({ sub: userId }, { expiresIn: 60, issuer: JWT_ISSUER })).expect(401);
    await me(await t.jwt.signAsync({ sub: userId }, { expiresIn: 60 })).expect(200);
  });

  it('rejects alg=none, tampered payloads, wrong keys and expired tokens', async () => {
    const none = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(claims(userId))}.`;
    await me(none).expect(401);

    const [header, , signature] = (await t.jwt.signAsync({ sub: userId }, { expiresIn: 60 })).split('.');
    await me(`${header}.${base64url(claims('someone-else'))}.${signature}`).expect(401);

    const payload = base64url(claims(userId));
    const forgedSignature = createHmac('sha256', 'attacker-key').update(`${header}.${payload}`).digest('base64url');
    await me(`${header}.${payload}.${forgedSignature}`).expect(401);

    await me(await t.jwt.signAsync({ sub: userId }, { expiresIn: -10 })).expect(401);
  });

  it('stores refresh tokens only as hashes', async () => {
    const { refreshToken } = (await login(t.http, EMAIL).expect(200)).body.data;
    expect(await t.prisma.refreshToken.count({ where: { tokenHash: refreshToken } })).toBe(0);
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(t.http()).get('/health').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('locks an account after repeated failures, even for the right password, with identical errors for real and unknown accounts', async () => {
    const victim = 'e2e-lockout@example.test';
    await ensureUser(t.prisma, victim);
    for (let i = 0; i < 3; i++) await login(t.http, victim, 'wrong-password-1').expect(401);
    const lockedReal = await login(t.http, victim, PASSWORD).expect(429);

    const ghost = 'e2e-ghost@example.test';
    for (let i = 0; i < 3; i++) await login(t.http, ghost, 'wrong-password-1').expect(401);
    const lockedGhost = await login(t.http, ghost, 'wrong-password-1').expect(429);

    expect(lockedReal.body.error.code).toBe('RATE_LIMITED');
    expect(lockedGhost.body.error).toEqual(lockedReal.body.error);
  });

  it('a successful login clears the failure counter', async () => {
    const email = 'e2e-reset@example.test';
    await ensureUser(t.prisma, email);
    for (let round = 0; round < 2; round++) {
      await login(t.http, email, 'wrong-password-1').expect(401);
      await login(t.http, email, 'wrong-password-1').expect(401);
      await login(t.http, email).expect(200);
    }
  });

  it('does not serve API docs when disabled', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    configureApp(app, { enableDocs: false });
    await app.init();
    await request(app.getHttpServer()).get('/api/openapi.json').expect(404);
    await request(app.getHttpServer()).get('/api/docs').expect(404);
    await app.close();
  });
});
