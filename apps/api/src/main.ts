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
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { runMain } from './common/run-main.js';
import { AppConfig } from './config/app-config.js';
import { APP_CONFIG } from './config/config.module.js';

runMain(async () => {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, { corsOrigins: config.corsOrigins, trustProxyHops: config.trustProxyHops, enableDocs: config.enableApiDocs });
  app.enableShutdownHooks();
  await app.listen(config.port);
});
