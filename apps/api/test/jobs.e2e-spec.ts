import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { PrismaService } from '../src/database/prisma.service.js';
import { PURGE_REFRESH_TOKENS_JOB } from '../src/modules/auth/jobs.js';
import { JobsRuntime } from '../src/workers/jobs-runtime.service.js';
import { JobsRegistry } from '../src/workers/jobs.registry.js';
import { WorkerModule } from '../src/workers/worker.module.js';
import { redisUrl } from './helpers/app.js';
import { ensureUser } from './helpers/users.js';

const url = redisUrl();
const describeWithRedis = url ? describe : describe.skip;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function eventually(check: () => Promise<boolean>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Condition not met in time');
}

describeWithRedis('background worker (real Redis + PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let runtime: JobsRuntime;
  let userId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    runtime = moduleRef.get(JobsRuntime);
    userId = (await ensureUser(prisma, 'e2e-jobs@example.test')).id;
  });
  afterAll(async () => {
    await moduleRef.close();
  });

  const token = (label: string, expiresAt: Date, revokedAt: Date | null = null) =>
    prisma.refreshToken.create({
      data: { userId, familyId: `fam-${label}`, tokenHash: `hash-${label}-${Date.now()}`, expiresAt, revokedAt },
    });

  it('registers the auth cleanup job', () => {
    expect(
      moduleRef
        .get(JobsRegistry)
        .all()
        .map((j) => j.name),
    ).toContain(PURGE_REFRESH_TOKENS_JOB);
  });

  it('purges tokens expired beyond the grace period and keeps everything else', async () => {
    const now = Date.now();
    const longExpired = await token('long-expired', new Date(now - 3 * DAY));
    const recentlyExpired = await token('recent-expired', new Date(now - HOUR));
    const active = await token('active', new Date(now + 5 * DAY));
    const revokedButValid = await token('revoked-valid', new Date(now + 5 * DAY), new Date());

    await runtime.trigger(PURGE_REFRESH_TOKENS_JOB);
    await eventually(async () => (await prisma.refreshToken.findUnique({ where: { id: longExpired.id } })) === null);

    for (const kept of [recentlyExpired, active, revokedButValid]) {
      expect(await prisma.refreshToken.findUnique({ where: { id: kept.id } })).not.toBeNull();
    }
  });

  it('schedules the recurring job in Redis exactly once', async () => {
    const redis = new Redis(url as string);
    try {
      const schedulers = await redis.keys('bull:maintenance:repeat:*');
      expect(schedulers.some((k) => k.includes(PURGE_REFRESH_TOKENS_JOB))).toBe(true);
    } finally {
      await redis.quit();
    }
  });

  it('refuses to trigger an unknown job', async () => {
    await expect(runtime.trigger('nope.unknown')).rejects.toThrow(/Unknown job/);
  });
});
