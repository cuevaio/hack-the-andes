import { DurableObject } from "cloudflare:workers";
import { requestPolicies } from "@chofex/request-limits";
import {
  type Bucket,
  type BucketStore,
  consumeSharedBudget,
} from "@chofex/request-limits/buckets";

interface Env {
  readonly LIMITS: DurableObjectNamespace<RateLimits>;
  readonly RATE_LIMIT_SERVICE_TOKEN: string;
}

export class RateLimits extends DurableObject<Env> {
  private sweptAt = 0;
  private readonly store: BucketStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec(
      "CREATE TABLE IF NOT EXISTS buckets (key TEXT PRIMARY KEY, tokens REAL NOT NULL, updatedAt INTEGER NOT NULL)",
    );
    sql.exec("CREATE INDEX IF NOT EXISTS bucket_expiry ON buckets(updatedAt)");
    this.store = {
      read: (key) =>
        sql
          .exec<{ tokens: number; updatedAt: number }>(
            "SELECT tokens, updatedAt FROM buckets WHERE key = ?",
            key,
          )
          .toArray()[0],
      write: (key: string, bucket: Bucket) => {
        sql.exec(
          "INSERT INTO buckets (key, tokens, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET tokens = excluded.tokens, updatedAt = excluded.updatedAt",
          key,
          bucket.tokens,
          bucket.updatedAt,
        );
      },
      removeExpired: (cutoff) => {
        sql.exec(
          "DELETE FROM buckets WHERE key != 'global' AND updatedAt <= ?",
          cutoff,
        );
      },
      countClients: () =>
        sql
          .exec<{ count: number }>(
            "SELECT COUNT(*) AS count FROM buckets WHERE key != 'global'",
          )
          .one().count,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const [, route, name, clientKey] = new URL(request.url).pathname.split("/");
    const policy = requestPolicies.find((candidate) => candidate.name === name);
    if (
      route !== "consume" ||
      !policy ||
      !clientKey ||
      !/^[a-f0-9]{64}$/.test(clientKey)
    )
      return new Response(null, { status: 400 });
    const now = Date.now();
    const retryAfter = this.ctx.storage.transactionSync(() => {
      if (now - this.sweptAt >= 60_000) {
        this.store.removeExpired(now - 120_000);
        this.sweptAt = now;
      }
      return consumeSharedBudget(this.store, policy, clientKey, now);
    });
    if (retryAfter !== undefined)
      return new Response(null, {
        status: 429,
        headers: {
          "retry-after": String(retryAfter),
          "cache-control": "no-store",
        },
      });
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (
      !env.RATE_LIMIT_SERVICE_TOKEN ||
      request.headers.get("authorization") !==
        `Bearer ${env.RATE_LIMIT_SERVICE_TOKEN}`
    )
      return new Response(null, { status: 401 });
    if (
      request.method !== "POST" ||
      !/^\/consume\/(read|write|execution|webhook|image|page)\/[a-f0-9]{64}$/.test(
        new URL(request.url).pathname,
      )
    )
      return new Response(null, { status: 400 });
    const name = new URL(request.url).pathname.split("/")[2];
    const object = env.LIMITS.get(env.LIMITS.idFromName(`v1:${name}`));
    return object.fetch(request);
  },
} satisfies ExportedHandler<Env>;
