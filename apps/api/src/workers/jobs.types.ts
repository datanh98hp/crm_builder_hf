export interface JobDefinition {
  /** Unique, namespaced by owning module, e.g. `auth.purge-expired-refresh-tokens`. */
  name: string;
  /** Recurrence interval. The schedule lives in Redis, so it fires once no matter how many workers run. */
  everyMs: number;
  /** Must be idempotent: BullMQ retries failed runs. */
  handler: () => Promise<unknown>;
}
