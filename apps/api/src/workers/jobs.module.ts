import { Module } from '@nestjs/common';
import { JobsRegistry } from './jobs.registry.js';
import { JobsRuntime } from './jobs-runtime.service.js';

/** Feature `*-jobs` modules import this to register jobs; only `WorkerModule` provides the runtime. */
@Module({ providers: [JobsRegistry], exports: [JobsRegistry] })
export class JobsRegistryModule {}

@Module({ imports: [JobsRegistryModule], providers: [JobsRuntime], exports: [JobsRuntime, JobsRegistryModule] })
export class JobsModule {}
