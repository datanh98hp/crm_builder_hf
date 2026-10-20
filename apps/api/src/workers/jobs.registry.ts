import { Injectable } from '@nestjs/common';
import { JobDefinition } from './jobs.types.js';

/** Modules contribute their recurring jobs here; the worker runtime schedules whatever is registered. */
@Injectable()
export class JobsRegistry {
  private readonly jobs = new Map<string, JobDefinition>();

  register(job: JobDefinition): void {
    if (this.jobs.has(job.name)) throw new Error(`Job "${job.name}" is already registered`);
    this.jobs.set(job.name, job);
  }

  get(name: string): JobDefinition | undefined {
    return this.jobs.get(name);
  }

  all(): JobDefinition[] {
    return [...this.jobs.values()];
  }
}
