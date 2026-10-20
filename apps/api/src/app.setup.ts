import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { requestIdMiddleware } from './common/logging/request-id.middleware.js';

export interface AppSetupOptions {
  corsOrigins?: string[];
  /** Number of reverse proxies in front of the API (Caddy = 1); 0 trusts none. */
  trustProxyHops?: number;
  /** API reference pages leak the full attack surface; off by default in production. */
  enableDocs?: boolean;
}

export function configureApp(app: INestApplication, { corsOrigins = [], trustProxyHops = 0, enableDocs = true }: AppSetupOptions = {}) {
  if (trustProxyHops > 0) (app as NestExpressApplication).set('trust proxy', trustProxyHops);
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  if (corsOrigins.length) app.enableCors({ origin: corsOrigins, credentials: true });
  if (enableDocs) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('BuildCRM Finance Advising API').setVersion('0.1.0').addBearerAuth().build(),
    );
    SwaggerModule.setup('api/docs', app, doc, { jsonDocumentUrl: 'api/openapi.json' });
  }
}
