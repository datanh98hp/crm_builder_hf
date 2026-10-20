import { jest } from '@jest/globals';
import { FallbackRateLimitStore } from './fallback-rate-limit.store.js';
import { MemoryRateLimitStore } from './memory-rate-limit.store.js';
import { RateLimitStore } from './rate-limit.store.js';

const broken = (): RateLimitStore => ({
  hit: jest.fn<RateLimitStore['hit']>().mockRejectedValue(new Error('redis down')),
  peek: jest.fn<RateLimitStore['peek']>().mockRejectedValue(new Error('redis down')),
  reset: jest.fn<RateLimitStore['reset']>().mockRejectedValue(new Error('redis down')),
});

describe('FallbackRateLimitStore', () => {
  it('keeps enforcing limits through the fallback when the shared store fails', async () => {
    const s = new FallbackRateLimitStore(broken(), new MemoryRateLimitStore());
    expect((await s.hit('k', 60_000)).count).toBe(1);
    expect((await s.hit('k', 60_000)).count).toBe(2);
    expect(await s.peek('k')).toBe(2);
    await s.reset('k');
    expect(await s.peek('k')).toBe(0);
  });

  it('uses the shared store while it is healthy', async () => {
    const primary = new MemoryRateLimitStore();
    const fallback = new MemoryRateLimitStore();
    const s = new FallbackRateLimitStore(primary, fallback);
    await s.hit('k', 60_000);
    expect(await primary.peek('k')).toBe(1);
    expect(await fallback.peek('k')).toBe(0);
  });
});
