import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

for (const envPath of ['.env', '../../.env', '../.env']) {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
    break;
  }
}

// Prisma 7: connection URL for the CLI (migrate/studio) lives here, not in schema.prisma.
// The runtime client connects through a driver adapter (see src/database/prisma.service.ts).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
