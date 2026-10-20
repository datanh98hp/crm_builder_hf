export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export type RateLimitPolicyName = 'default' | 'login' | 'refresh';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl?: string;
  jwtAccessSecret: string;
  accessTtlSeconds: number;
  refreshTtlDays: number;
  corsOrigins: string[];
  trustProxyHops: number;
  enableApiDocs: boolean;
  rateLimits: Record<RateLimitPolicyName, RateLimitPolicy>;
  /** Failed logins per account (any IP) before the account is temporarily locked. */
  accountLockout: RateLimitPolicy;
}

const MINUTE = 60_000;
const MIN_SECRET_LENGTH = 32;

/** Reads typed values from the environment and collects every problem instead of stopping at the first. */
class EnvReader {
  readonly errors: string[] = [];

  constructor(private readonly env: NodeJS.ProcessEnv) { }

  required(key: string): string {
    const value = this.env[key];
    if (!value) this.errors.push(`${key} is required`);
    return value ?? '';
  }

  optional(key: string): string | undefined {
    return this.env[key] || undefined;
  }

  int(key: string, fallback: number): number {
    const raw = this.env[key];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0) return n;
    this.errors.push(`${key} must be a non-negative integer`);
    return fallback;
  }

  list(key: string): string[] {
    return (this.env[key] ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function checkSecurity(reader: EnvReader, { isProd, secret, redisUrl }: { isProd: boolean; secret: string; redisUrl?: string }) {
  if (secret && secret.length < MIN_SECRET_LENGTH) reader.errors.push(`JWT_ACCESS_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  if (isProd && secret.startsWith('change-me')) reader.errors.push('JWT_ACCESS_SECRET must not use the example value in production');
  // Without Redis, limits and lockouts are per process and silently weaken once a second replica runs.
  if (isProd && !redisUrl) reader.errors.push('REDIS_URL is required in production');
}

/** Single place where process.env is read. Fails fast with every problem listed at once. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const reader = new EnvReader(env);
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';
  const jwtAccessSecret = reader.required('JWT_ACCESS_SECRET');
  const redisUrl = reader.optional('REDIS_URL');
  checkSecurity(reader, { isProd, secret: jwtAccessSecret, redisUrl });

  const config: AppConfig = {
    nodeEnv,
    port: reader.int('PORT', 3000),
    databaseUrl: reader.required('DATABASE_URL'),
    redisUrl,
    jwtAccessSecret,
    accessTtlSeconds: reader.int('ACCESS_TOKEN_TTL_SECONDS', 900),
    refreshTtlDays: reader.int('REFRESH_TOKEN_TTL_DAYS', 14),
    corsOrigins: reader.list('CORS_ORIGINS'),
    trustProxyHops: reader.int('TRUST_PROXY_HOPS', 0),
    enableApiDocs: env.ENABLE_API_DOCS ? env.ENABLE_API_DOCS === 'true' : !isProd,
    rateLimits: {
      default: { limit: reader.int('DEFAULT_RATE_LIMIT', 120), windowMs: MINUTE },
      login: { limit: reader.int('LOGIN_RATE_LIMIT', 5), windowMs: MINUTE },
      refresh: { limit: reader.int('REFRESH_RATE_LIMIT', 20), windowMs: MINUTE },
    },
    accountLockout: { limit: reader.int('ACCOUNT_LOGIN_LIMIT', 10), windowMs: 15 * MINUTE },
  };

  // Checked after the object is built so numeric parse errors are reported together with the rest.
  if (reader.errors.length) throw new Error(`Invalid configuration: ${reader.errors.join('; ')}`);
  return config;
}
