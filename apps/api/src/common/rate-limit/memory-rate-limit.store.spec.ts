import { MemoryRateLimitStore } from './memory-rate-limit.store.js';

describe('MemoryRateLimitStore', () => {
  it('counts hits per key inside a window and isolates keys', async () => {
    const s = new MemoryRateLimitStore(() => 1_000);
    expect((await s.hit('a', 60_000)).count).toBe(1);
    expect((await s.hit('a', 60_000)).count).toBe(2);
    expect((await s.hit('b', 60_000)).count).toBe(1);
  });

  it('starts a new window after the window elapses', async () => {
    let t = 0;
    const s = new MemoryRateLimitStore(() => t);
    await s.hit('a', 1_000);
    await s.hit('a', 1_000);
    t = 1_001;
    expect((await s.hit('a', 1_000)).count).toBe(1);
  });

  it('reports when the window resets', async () => {
    const s = new MemoryRateLimitStore(() => 5_000);
    expect((await s.hit('a', 2_000)).resetAt).toBe(7_000);
  });

  it('peek does not count, and reset clears the window', async () => {
    const s = new MemoryRateLimitStore(() => 1_000);
    await s.hit('a', 60_000);
    await s.hit('a', 60_000);
    expect(await s.peek('a')).toBe(2);
    expect(await s.peek('a')).toBe(2);
    await s.reset('a');
    expect(await s.peek('a')).toBe(0);
  });
});
