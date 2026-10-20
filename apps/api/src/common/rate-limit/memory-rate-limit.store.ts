import { RateLimitState, RateLimitStore } from './rate-limit.store.js';

/** Per-process fixed-window counter: used when Redis is unavailable (development, tests, outages). */
export class MemoryRateLimitStore implements RateLimitStore {
  private windows = new Map<string, RateLimitState>();
  private lastSweep = 0;

  constructor(private now: () => number = Date.now) {}

  async hit(key: string, windowMs: number): Promise<RateLimitState> {
    const t = this.now();
    this.sweep(t);
    let w = this.windows.get(key);
    if (!w || w.resetAt <= t) {
      w = { count: 0, resetAt: t + windowMs };
      this.windows.set(key, w);
    }
    w.count += 1;
    return { ...w };
  }

  async peek(key: string): Promise<number> {
    const w = this.windows.get(key);
    return w && w.resetAt > this.now() ? w.count : 0;
  }

  async reset(key: string): Promise<void> {
    this.windows.delete(key);
  }

  /** Drops expired windows at most once per second so memory stays bounded. */
  private sweep(t: number) {
    if (t - this.lastSweep < 1000) return;
    this.lastSweep = t;
    for (const [k, w] of this.windows) if (w.resetAt <= t) this.windows.delete(k);
  }
}
