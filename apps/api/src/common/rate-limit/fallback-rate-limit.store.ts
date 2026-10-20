import { Logger } from '@nestjs/common';
import { RateLimitStore } from './rate-limit.store.js';

/**
 * Uses the shared store and degrades to a per-process one if it errors, instead of failing every
 * request (outage) or skipping limits (bypass). Limits are weaker during an outage but never absent.
 */
export class FallbackRateLimitStore implements RateLimitStore {
  private readonly logger = new Logger('RateLimit');
  private lastWarning = 0;

  constructor(
    private primary: RateLimitStore,
    private fallback: RateLimitStore,
  ) {}

  hit(key: string, windowMs: number) {
    return this.run((s) => s.hit(key, windowMs));
  }
  peek(key: string) {
    return this.run((s) => s.peek(key));
  }
  reset(key: string) {
    return this.run((s) => s.reset(key));
  }

  private async run<T>(op: (store: RateLimitStore) => Promise<T>): Promise<T> {
    try {
      return await op(this.primary);
    } catch (error) {
      this.warn(error);
      return op(this.fallback);
    }
  }

  private warn(error: unknown) {
    const now = Date.now();
    if (now - this.lastWarning < 30_000) return;
    this.lastWarning = now;
    this.logger.warn(`Shared rate-limit store unavailable, using per-process fallback: ${(error as Error).message}`);
  }
}
