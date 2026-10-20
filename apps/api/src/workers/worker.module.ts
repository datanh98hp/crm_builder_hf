import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthJobsModule } from '../modules/auth/jobs.js';
import { RedisModule } from '../redis/redis.module.js';
import { JobsModule } from './jobs.module.js';

/** Composition root of the worker process. Add each module's `*JobsModule` here. */
@Module({ imports: [ConfigModule, DatabaseModule, RedisModule, JobsModule, AuthJobsModule] })
export class WorkerModule {}
