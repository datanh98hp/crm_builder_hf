import 'reflect-metadata';
import { existsSync } from 'node:fs';

// Load .env automatically if present
for (const envPath of ['.env', '../../.env', '../.env']) {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
    break;
  }
}

import { NestFactory } from '@nestjs/core';
import { runMain } from './common/run-main.js';
import { WorkerModule } from './workers/worker.module.js';

/** Entrypoint for the background worker. Same image as the API, different command. */
runMain(async () => {
  const app = await NestFactory.createApplicationContext(WorkerModule, { abortOnError: false });
  app.enableShutdownHooks();
});
