import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies the right password and rejects the wrong one', async () => {
    const h = await hashPassword('Correct-Horse-1!');
    expect(await verifyPassword('Correct-Horse-1!', h)).toBe(true);
    expect(await verifyPassword('wrong-password', h)).toBe(false);
  });
  it('uses a unique salt per hash', async () => {
    expect(await hashPassword('same-password')).not.toEqual(await hashPassword('same-password'));
  });
  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'plaintext')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$a$b')).toBe(false);
  });
});

describe('password hash format', () => {
  it('stores scrypt parameters and a per-hash salt', async () => {
    const h = await hashPassword('Another-Pass-1!');
    expect(h).toMatch(/^scrypt\$32768\$8\$1\$/);
  });
  it('still verifies legacy 3-part hashes created before parameters were stored', async () => {
    const { scryptSync, randomBytes } = await import('node:crypto');
    const salt = randomBytes(16);
    const legacy = `scrypt$${salt.toString('base64')}$${scryptSync('legacy-pass-1', salt, 64).toString('base64')}`;
    expect(await verifyPassword('legacy-pass-1', legacy)).toBe(true);
    expect(await verifyPassword('wrong', legacy)).toBe(false);
  });
  it('rejects out-of-bounds cost parameters instead of allocating memory', async () => {
    expect(await verifyPassword('x', 'scrypt$1048576$8$1$c2FsdA==$a2V5')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$32768$8$99$c2FsdA==$a2V5')).toBe(false);
  });
});
