import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type BucketStore, consumeSharedBudget } from "./buckets.js";
import { requestPolicies } from "./index.js";

const policy = requestPolicies[2];
const openStore = (path: string) => {
  const db = new Database(path);
  db.run(
    "CREATE TABLE IF NOT EXISTS buckets (key TEXT PRIMARY KEY, tokens REAL NOT NULL, updatedAt INTEGER NOT NULL)",
  );
  const store: BucketStore = {
    read: (key) => {
      const row: unknown = db
        .query("SELECT tokens, updatedAt FROM buckets WHERE key = ?")
        .get(key);
      if (
        row &&
        typeof row === "object" &&
        "tokens" in row &&
        "updatedAt" in row &&
        typeof row.tokens === "number" &&
        typeof row.updatedAt === "number"
      )
        return { tokens: row.tokens, updatedAt: row.updatedAt };
    },
    write: (key, bucket) => {
      db.run("INSERT OR REPLACE INTO buckets VALUES (?, ?, ?)", [
        key,
        bucket.tokens,
        bucket.updatedAt,
      ]);
    },
    countClients: () =>
      db.query("SELECT key FROM buckets WHERE key != 'global'").all().length,
    removeExpired: (cutoff) => {
      db.run("DELETE FROM buckets WHERE key != 'global' AND updatedAt <= ?", [
        cutoff,
      ]);
    },
  };
  return { db, store };
};

test("replicas and restarts share the same client budget", async () => {
  const directory = await mkdtemp(join(tmpdir(), "andes-budget-"));
  const path = join(directory, "limits.sqlite");
  try {
    const first = openStore(path);
    const second = openStore(path);
    try {
      for (let index = 0; index < policy.burst; index += 1) {
        const store = index % 2 === 0 ? first.store : second.store;
        expect(
          consumeSharedBudget(store, policy, "client", 1_000),
        ).toBeUndefined();
      }
      expect(consumeSharedBudget(second.store, policy, "client", 1_000)).toBe(
        2,
      );
    } finally {
      first.db.close();
      second.db.close();
    }
    const restarted = openStore(path);
    try {
      expect(
        consumeSharedBudget(restarted.store, policy, "client", 1_000),
      ).toBe(2);
      expect(
        consumeSharedBudget(restarted.store, policy, "client", 3_000),
      ).toBeUndefined();
    } finally {
      restarted.db.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rotating client identities cannot bypass the aggregate budget", () => {
  const { db, store } = openStore(":memory:");
  try {
    for (let index = 0; index < policy.globalBurst; index += 1)
      expect(
        consumeSharedBudget(store, policy, String(index), 1_000),
      ).toBeUndefined();
    expect(consumeSharedBudget(store, policy, "new-client", 1_000)).toBe(1);
    expect(
      consumeSharedBudget(store, policy, "new-client", 1_500),
    ).toBeUndefined();
  } finally {
    db.close();
  }
});

test("client rejection preserves other clients' aggregate budget", () => {
  const { db, store } = openStore(":memory:");
  try {
    for (let index = 0; index < policy.burst; index += 1)
      consumeSharedBudget(store, policy, "limited-client", 1_000);
    for (let index = 0; index < 100; index += 1)
      expect(consumeSharedBudget(store, policy, "limited-client", 1_000)).toBe(
        2,
      );
    expect(store.read("global")?.tokens).toBe(
      policy.globalBurst - policy.burst,
    );
    expect(
      consumeSharedBudget(store, policy, "other-client", 1_000),
    ).toBeUndefined();
  } finally {
    db.close();
  }
});

test("full stores reject new identities without evicting active limits", () => {
  const { db, store } = openStore(":memory:");
  try {
    db.transaction(() => {
      for (let index = 0; index < 10_000; index += 1)
        store.write(String(index), { tokens: 0, updatedAt: 1_000 });
    })();
    expect(consumeSharedBudget(store, policy, "new-client", 1_000)).toBe(60);
    expect(consumeSharedBudget(store, policy, "0", 1_000)).toBe(2);
    store.removeExpired(121_000);
    expect(
      consumeSharedBudget(store, policy, "new-client", 121_000),
    ).toBeUndefined();
  } finally {
    db.close();
  }
});
