import { Global, Module } from '@nestjs/common';
import { AppConfig, loadConfig } from './app-config.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Validated, immutable configuration injected with `@Inject(APP_CONFIG)`. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: (): AppConfig => Object.freeze(loadConfig()) as AppConfig }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
