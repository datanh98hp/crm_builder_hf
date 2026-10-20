import { JobsRegistry } from './jobs.registry.js';

describe('JobsRegistry', () => {
  const job = (name: string) => ({ name, everyMs: 1_000, handler: async () => undefined });

  it('registers and returns jobs by name', () => {
    const registry = new JobsRegistry();
    registry.register(job('a.one'));
    registry.register(job('b.two'));
    expect(registry.get('a.one')?.name).toBe('a.one');
    expect(registry.all().map((j) => j.name)).toEqual(['a.one', 'b.two']);
    expect(registry.get('missing')).toBeUndefined();
  });

  it('rejects duplicate names so two modules cannot silently shadow each other', () => {
    const registry = new JobsRegistry();
    registry.register(job('a.one'));
    expect(() => registry.register(job('a.one'))).toThrow(/already registered/);
  });
});
