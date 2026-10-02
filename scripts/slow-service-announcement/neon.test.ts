import { expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { createPgliteFetch } from "../../apps/web/lib/registration/fixtures/neon-pglite";
import { snapshot } from "./campaign";
import { createDeliveryStore } from "./delivery";

test("the production Neon HTTP driver runs fenced CTEs and permanent account claims against real local PostgreSQL", async () => {
  const pg = new PGlite();
  const previousFetch = neonConfig.fetchFunction;
  try {
    await pg.exec(`CREATE TABLE funnel_email_deliveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clerk_user_id varchar(255) NOT NULL,
      stage varchar(32) NOT NULL, scope_id varchar(255) NOT NULL, status varchar(16) NOT NULL DEFAULT 'sending',
      trigger_run_id text NOT NULL, sent_at timestamptz, error text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (clerk_user_id, stage, scope_id)
    );`);
    neonConfig.fetchFunction = await createPgliteFetch(pg);
    const database = drizzle({
      client: neon("postgresql://test@local.invalid/announcement"),
    });
    const store = createDeliveryStore(database);
    const ownership = await store.acquireLease();
    if (ownership.kind !== "acquired")
      throw new Error("Expected campaign ownership");
    const lease = ownership.lease;
    expect(await store.acquireLease()).toEqual({ kind: "busy" });
    await store.heartbeat(lease);
    await store.freezeSnapshot(snapshot(), lease);
    const recipient = { clerkUserId: "wire-user", email: "wire@example.com" };
    await store.bindAccounts([recipient], snapshot().contentHash, lease);
    const first = await store.claim(recipient, snapshot(), lease);
    if (first.kind !== "claimed") throw new Error("Expected first delivery");
    expect(
      await store.claim(
        { ...recipient, email: "changed@example.com" },
        snapshot(),
        lease,
      ),
    ).toEqual({ kind: "address_changed" });
    await store.finish(first.scope, first.metadata, lease, {
      kind: "sent",
      providerId: "accepted-wire-email",
    });
    expect(
      await store.claim(
        { ...recipient, email: "changed@example.com" },
        snapshot(),
        lease,
      ),
    ).toEqual({ kind: "duplicate" });
    expect(await store.progress([recipient])).toEqual({
      pending: 0,
      sent: 1,
      busy: 0,
      retryable: 0,
      addressChanged: 0,
      reconciliationRequired: 0,
    });
    expect(await store.releaseLease(lease)).toBe(true);
  } finally {
    neonConfig.fetchFunction = previousFetch;
    await pg.close();
  }
});
