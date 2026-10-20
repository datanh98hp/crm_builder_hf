import { Logger } from '@nestjs/common';

/** Runs a process entrypoint; a failed start (bad config, unreachable database) logs once and exits 1. */
export function runMain(main: () => Promise<unknown>): void {
  main().catch((error: unknown) => {
    Logger.error(error instanceof Error ? error.message : String(error), undefined, 'Bootstrap');
    process.exit(1);
  });
}
