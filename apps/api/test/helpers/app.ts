import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import type { Server } from 'node:http';
import { AppModule } from '../../src/app.module.js';
import { AppSetupOptions, configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/database/prisma.service.js';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  jwt: JwtService;
  http: () => Server;
}

/** Boots the real HTTP app against the real database. Env vars must be set before calling. */
export async function createTestApp(options: { controllers?: Type[]; setup?: AppSetupOptions } = {}): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers: options.controllers ?? [] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, options.setup);
  await app.init();
  return { app, prisma: app.get(PrismaService), jwt: app.get(JwtService), http: () => app.getHttpServer() as Server };
}

export const redisUrl = (): string | undefined => process.env.REDIS_URL || undefined;

/** Removes rate-limit counters left by earlier runs so tests start from a clean slate. */
export async function clearRateLimitKeys(url = redisUrl()): Promise<void> {
  if (!url) return;
  const redis = new Redis(url);
  try {
    const keys = await redis.keys('rl:*');
    if (keys.length) await redis.del(...keys);
  } finally {
    await redis.quit();
  }
}
