import type { Policy } from "./index.js";

export interface Bucket {
  readonly tokens: number;
  readonly updatedAt: number;
}

export interface BucketStore {
  read(key: string): Bucket | undefined;
  write(key: string, bucket: Bucket): void;
  removeExpired(cutoff: number): void;
  countClients(): number;
}

const refill = (
  bucket: Bucket | undefined,
  burst: number,
  perMinute: number,
  now: number,
): Bucket => {
  if (!bucket) return { tokens: burst, updatedAt: now };
  return {
    tokens: Math.min(
      burst,
      bucket.tokens +
        (Math.max(0, now - bucket.updatedAt) * perMinute) / 60_000,
    ),
    updatedAt: Math.max(now, bucket.updatedAt),
  };
};

export const consumeSharedBudget = (
  store: BucketStore,
  policy: Policy,
  clientKey: string,
  now: number,
): number | undefined => {
  const global = refill(
    store.read("global"),
    policy.globalBurst,
    policy.globalPerMinute,
    now,
  );
  if (global.tokens < 1)
    return Math.max(
      1,
      Math.ceil(((1 - global.tokens) * 60) / policy.globalPerMinute),
    );
  const storedClient = store.read(clientKey);
  if (!storedClient && store.countClients() >= 10_000) return 60;
  const client = refill(storedClient, policy.burst, policy.perMinute, now);
  if (client.tokens < 1)
    return Math.max(
      1,
      Math.ceil(((1 - client.tokens) * 60) / policy.perMinute),
    );
  store.write(clientKey, { ...client, tokens: client.tokens - 1 });
  store.write("global", { ...global, tokens: global.tokens - 1 });
};
