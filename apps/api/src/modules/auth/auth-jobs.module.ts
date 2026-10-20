import { Inject, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { JobsRegistryModule } from '../../workers/jobs.module.js';
import { JobsRegistry } from '../../workers/jobs.registry.js';
import { RefreshTokenCleanupService } from './refresh-token-cleanup.service.js';

export const PURGE_REFRESH_TOKENS_JOB = 'auth.purge-expired-refresh-tokens';

@Injectable()
class AuthJobs implements OnModuleInit {
  private readonly logger = new Logger('AuthJobs');

  constructor(
    @Inject(JobsRegistry) private registry: JobsRegistry,
    @Inject(RefreshTokenCleanupService) private cleanup: RefreshTokenCleanupService,
  ) { }

  onModuleInit() {
    this.registry.register({
      name: PURGE_REFRESH_TOKENS_JOB,
      everyMs: 60 * 60_000,
      handler: async () => {
        const removed = await this.cleanup.purgeExpired();
        this.logger.log(`Purged ${removed} expired refresh token(s)`);
      },
    });
  }
}

/** Background jobs owned by the auth module; imported by the worker process only. */
@Module({ imports: [JobsRegistryModule], providers: [AuthJobs, RefreshTokenCleanupService] })
export class AuthJobsModule { }
