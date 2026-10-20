import { pgOptionsFromUrl } from './prisma.service.js';

describe('pgOptionsFromUrl', () => {
  it('moves the Prisma-only ?schema= option out of the connection string', () => {
    const { connectionString, schema } = pgOptionsFromUrl('postgresql://u:p@db:5432/app?schema=billing&sslmode=require');
    expect(schema).toBe('billing');
    expect(connectionString).toContain('sslmode=require');
    expect(connectionString).not.toContain('schema=');
  });

  it('leaves the schema undefined when none is given', () => {
    expect(pgOptionsFromUrl('postgresql://u:p@db:5432/app').schema).toBeUndefined();
  });
});
