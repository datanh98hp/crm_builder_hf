import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { RequirePermission } from '../src/common/auth/decorators.js';
import { PERMISSIONS } from '../src/common/auth/permissions.js';
import { clearRateLimitKeys, createTestApp, TestApp } from './helpers/app.js';
import { ensureUser, grantPermissions, login } from './helpers/users.js';

// Rate limiting has its own suites with dedicated app instances.
process.env.LOGIN_RATE_LIMIT = '1000';

@Controller('test-protected')
class ProtectedController {
  @Get('audit') @RequirePermission(PERMISSIONS.AuditRead) audit() {
    return { ok: true };
  }
  @Get('users') @RequirePermission(PERMISSIONS.UsersManage) users() {
    return { ok: true };
  }
}

const ADMIN = 'e2e-admin@example.test';
const PLAIN = 'e2e-advisor@example.test';

describe('API (e2e, real PostgreSQL)', () => {
  let t: TestApp;

  beforeAll(async () => {
    await clearRateLimitKeys();
    t = await createTestApp({ controllers: [ProtectedController] });
    const admin = await ensureUser(t.prisma, ADMIN);
    await grantPermissions(t.prisma, admin.id, { [PERMISSIONS.AuditRead]: 'ALL' });
    await ensureUser(t.prisma, PLAIN);
  });
  afterAll(async () => {
    await t.app.close();
  });

  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  const accessTokenOf = async (email: string) => (await login(t.http, email).expect(200)).body.data.accessToken as string;

  it('GET /health is public and minimal; /ready checks dependencies', async () => {
    const health = await request(t.http()).get('/health').expect(200);
    expect(health.body.data).toEqual({ status: 'ok' });
    expect(health.body.meta.requestId).toBeDefined();
    await request(t.http()).get('/ready').expect(200);
  });

  it('echoes a safe x-request-id and returns the error envelope with the same id', async () => {
    const res = await request(t.http()).get('/api/v1/auth/me').set('x-request-id', 'req-e2e-12345').expect(401);
    expect(res.headers['x-request-id']).toBe('req-e2e-12345');
    expect(res.body.error.code).toBe('AUTH_UNAUTHENTICATED');
    expect(res.body.meta.requestId).toBe('req-e2e-12345');
  });

  it('replaces an unsafe x-request-id instead of echoing it', async () => {
    const res = await request(t.http()).get('/health').set('x-request-id', 'bad id\twith spaces').expect(200);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects invalid input with VALIDATION_FAILED and unknown fields', async () => {
    const res = await request(t.http()).post('/api/v1/auth/login').send({ email: 'nope', password: 'x', extra: 1 }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('login fails with the same generic error for a wrong password and an unknown email', async () => {
    const wrongPassword = await login(t.http, ADMIN, 'wrong-password-1').expect(401);
    const unknownEmail = await login(t.http, 'ghost@example.test').expect(401);
    expect(wrongPassword.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(unknownEmail.body.error).toEqual(wrongPassword.body.error);
  });

  it('login -> /auth/me returns only safe fields', async () => {
    const token = await accessTokenOf(ADMIN);
    const me = await request(t.http()).get('/api/v1/auth/me').set(bearer(token)).expect(200);
    expect(me.body.data.email).toBe(ADMIN);
    expect(me.body.data.permissions).toEqual([PERMISSIONS.AuditRead]);
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|scrypt/);
  });

  it('enforces permissions on the server (403 without the grant, 200 with it)', async () => {
    const admin = bearer(await accessTokenOf(ADMIN));
    const plain = bearer(await accessTokenOf(PLAIN));
    await request(t.http()).get('/api/v1/test-protected/audit').set(admin).expect(200);
    await request(t.http()).get('/api/v1/test-protected/users').set(admin).expect(403);
    const denied = await request(t.http()).get('/api/v1/test-protected/audit').set(plain).expect(403);
    expect(denied.body.error.code).toBe('RESOURCE_FORBIDDEN');
  });

  it('rotates refresh tokens and revokes the family when an old token is replayed', async () => {
    const first = (await login(t.http, ADMIN).expect(200)).body.data;
    const second = (await request(t.http()).post('/api/v1/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200)).body.data;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await request(t.http()).post('/api/v1/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401); // replay
    await request(t.http()).post('/api/v1/auth/refresh').send({ refreshToken: second.refreshToken }).expect(401); // family revoked
    expect(await t.prisma.auditLog.findFirst({ where: { action: 'auth.refresh_reuse_detected' } })).not.toBeNull();
  });

  it('logout revokes the session', async () => {
    const tokens = (await login(t.http, ADMIN).expect(200)).body.data;
    await request(t.http()).post('/api/v1/auth/logout').send({ refreshToken: tokens.refreshToken }).expect(204);
    await request(t.http()).post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
  });

  it('a disabled user loses access immediately even with a valid access token', async () => {
    const email = 'e2e-disabled@example.test';
    await ensureUser(t.prisma, email);
    const token = await accessTokenOf(email);
    await t.prisma.user.update({ where: { email }, data: { status: 'DISABLED' } });
    await request(t.http()).get('/api/v1/auth/me').set(bearer(token)).expect(401);
  });

  it('serves OpenAPI JSON when docs are enabled', async () => {
    const res = await request(t.http()).get('/api/openapi.json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/api/v1/auth/login', '/api/v1/auth/me']));
  });
});
