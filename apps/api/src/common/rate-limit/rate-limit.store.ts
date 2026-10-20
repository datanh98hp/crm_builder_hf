export interface RateLimitState {
  count: number;
  /** Epoch milliseconds at which the current window ends. */
  resetAt: number;
}

export interface RateLimitStore {
  /** Registers one hit for `key` in a fixed window and returns the running state. */
  hit(key: string, windowMs: number): Promise<RateLimitState>;
  /** Count in the active window without registering a hit. */
  peek(key: string): Promise<number>;
  reset(key: string): Promise<void>;
}

export const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');
