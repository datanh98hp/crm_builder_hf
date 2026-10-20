import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/config.module.js';

/** Prisma `?schema=` is not a libpq option, so it is split out and passed to the adapter. */
export function pgOptionsFromUrl(url: string): { connectionString: string; schema?: string } {
  const u = new URL(url);
  const schema = u.searchParams.get('schema') ?? undefined;
  u.searchParams.delete('schema');
  return { connectionString: u.toString(), schema };
}

export function createAdapter(url: string) {
  const { connectionString, schema } = pgOptionsFromUrl(url);
  return new PrismaPg({ connectionString }, schema ? { schema } : undefined);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({ adapter: createAdapter(config.databaseUrl) });
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
