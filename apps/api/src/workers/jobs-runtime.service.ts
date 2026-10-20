import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { JobsOptions, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/config.module.js';
import { JobsRegistry } from './jobs.registry.js';

const MAINTENANCE_QUEUE = 'maintenance';

const JOB_OPTIONS: JobsOptions = { attempts: 3, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: 20, removeOnFail: 100 };

/**
 * Runs registered jobs through BullMQ. Intended for the dedicated worker process (`worker.ts`),
 * not the HTTP API, so job load can be scaled and deployed independently.
 */
@Injectable()
export class JobsRuntime implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Jobs');
  private connections: Redis[] = [];
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    @Inject(JobsRegistry) private registry: JobsRegistry,
    @Inject(APP_CONFIG) private config: AppConfig,
  ) { }

  async onApplicationBootstrap() {
    if (!this.config.redisUrl) throw new Error('Background jobs require REDIS_URL');
    const { redisUrl } = this.config;
    // BullMQ requires maxRetriesPerRequest=null on blocking connections; each Queue/Worker gets its own.
    const connect = () => {
      const c = new Redis(redisUrl, { maxRetriesPerRequest: null });
      c.on('error', (e: Error) => this.logger.warn(`Redis error: ${e.message}`));
      this.connections.push(c);
      return c;
    };

    this.queue = new Queue(MAINTENANCE_QUEUE, { connection: connect() });
    this.worker = new Worker(
      MAINTENANCE_QUEUE,
      async (job) => {
        const def = this.registry.get(job.name);
        if (!def) throw new Error(`No handler registered for job "${job.name}"`);
        await def.handler();
      },
      { connection: connect() },
    );
    this.worker.on('completed', (job) => this.logger.log(`Job ${job.name} completed`));
    this.worker.on('failed', (job, error) => this.logger.error(`Job ${job?.name} failed (attempt ${job?.attemptsMade}): ${error.message}`));
    this.worker.on('error', (error) => this.logger.error(`Worker error: ${error.message}`));

    const jobs = this.registry.all();
    for (const def of jobs) {
      await this.queue.upsertJobScheduler(def.name, { every: def.everyMs }, { name: def.name, opts: JOB_OPTIONS });
    }
    // Drop schedules left behind by jobs that no longer exist so they do not fail forever.
    const registered = new Set(jobs.map((j) => j.name));
    for (const scheduler of await this.queue.getJobSchedulers()) {
      if (scheduler.key && !registered.has(scheduler.key)) await this.queue.removeJobScheduler(scheduler.key);
    }
    this.logger.log(`Worker ready, ${jobs.length} job(s) scheduled: ${jobs.map((j) => j.name).join(', ') || 'none'}`);
  }

  /** Enqueue a registered job now (operations, tests). It still runs on the worker with retries. */
  async trigger(name: string): Promise<void> {
    if (!this.registry.get(name)) throw new Error(`Unknown job "${name}"`);
    await this.queue?.add(name, {}, JOB_OPTIONS);
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await Promise.all(this.connections.map((c) => c.quit().catch(() => c.disconnect())));
  }
}
