import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

// scrypt cost (OWASP: N=2^17,r=8 or an equivalent trade-off). N=2^15 needs ~32 MiB per hash,
// which stays affordable under the login rate limits. Parameters are stored per hash so they can be raised later.
type Params = { N: number; r: number; p: number };
const PARAMS: Params = { N: 32768, r: 8, p: 1 };
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;
const LEGACY_PARAMS = { N: 16384, r: 8, p: 1 } as const;

function derive(password: string, salt: Buffer, len: number, { N, r, p }: Params): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, len, { N, r, p, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Format: scrypt$N$r$p$salt$hash (base64). Legacy `scrypt$salt$hash` (N=16384,r=8,p=1) still verifies. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

interface ParsedHash {
  params: Params;
  salt: Buffer;
  key: Buffer;
}

function parseStoredHash(stored: string): ParsedHash | null {
  const parts = stored.split('$');
  let params: Params;
  let saltB64: string | undefined;
  let keyB64: string | undefined;
  if (parts[0] === 'scrypt' && parts.length === 3) {
    params = LEGACY_PARAMS;
    [, saltB64, keyB64] = parts;
  } else if (parts[0] === 'scrypt' && parts.length === 6) {
    params = { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
    [, , , , saltB64, keyB64] = parts;
  } else {
    return null;
  }
  if (!saltB64 || !keyB64 || !withinBounds(params)) return null;
  return { params, salt: Buffer.from(saltB64, 'base64'), key: Buffer.from(keyB64, 'base64') };
}

/** Bounds stored parameters so a corrupted row cannot trigger an unbounded memory/CPU allocation. */
function withinBounds({ N, r, p }: Params): boolean {
  return Number.isInteger(Math.log2(N)) && N >= 2 ** 14 && N <= 2 ** 17 && r === 8 && p === 1;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  const actual = await derive(password, parsed.salt, parsed.key.length, parsed.params);
  return actual.length === parsed.key.length && timingSafeEqual(actual, parsed.key);
}
