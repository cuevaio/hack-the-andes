import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "@chofex/db/orm";
import { funnelEmailDeliveries } from "@chofex/db/schema";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  accountScope,
  digest,
  leaseMs,
  recipientScope,
  snapshot,
} from "./campaign";
import { type CampaignLease, createDeliveryStore } from "./delivery";

describe("persistent account, address and owner claims", () => {
  let pg: PGlite;
  let database: ReturnType<typeof drizzle>;
  let store: ReturnType<typeof createDeliveryStore>;
  const recipient = {
    clerkUserId: "registered-user",
    email: "participant@example.com",
  };

  beforeEach(async () => {
    pg = new PGlite();
    database = drizzle(pg);
    store = createDeliveryStore(database);
    await pg.exec(`CREATE TABLE funnel_email_deliveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clerk_user_id varchar(255) NOT NULL,
      stage varchar(32) NOT NULL, scope_id varchar(255) NOT NULL, status varchar(16) NOT NULL DEFAULT 'sending',
      trigger_run_id text NOT NULL, sent_at timestamptz, error text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (clerk_user_id, stage, scope_id)
    );`);
  });
  afterEach(async () => {
    await pg.close();
  });

  async function acquire(): Promise<CampaignLease> {
    const ownership = await store.acquireLease();
    if (ownership.kind !== "acquired")
      throw new Error("Expected campaign ownership");
    return ownership.lease;
  }
  async function sender() {
    const lease = await acquire();
    await store.freezeSnapshot(snapshot(), lease);
    return lease;
  }
  async function expireOwner() {
    await database
      .update(funnelEmailDeliveries)
      .set({ updatedAt: new Date(Date.now() - leaseMs - 1_000) })
      .where(eq(funnelEmailDeliveries.scopeId, "campaign_lease"));
  }
  async function targetRows() {
    const rows = await database.select().from(funnelEmailDeliveries);
    return rows.filter((row) => row.scopeId.startsWith("recipient/"));
  }

  test("dry-run reads create no owner, snapshot, account or delivery records", async () => {
    expect(await store.readSnapshot(snapshot())).toBe(false);
    expect(await store.progress([recipient])).toEqual({
      pending: 1,
      sent: 0,
      busy: 0,
      retryable: 0,
      addressChanged: 0,
      reconciliationRequired: 0,
    });
    expect(await database.select().from(funnelEmailDeliveries)).toEqual([]);
    await sender();
    expect(await store.readSnapshot(snapshot())).toBe(true);
    const rows = await database.select().from(funnelEmailDeliveries);
    expect(
      rows
        .map((row) => ({ scope: row.scopeId, status: row.status }))
        .sort((a, b) => a.scope.localeCompare(b.scope)),
    ).toEqual([
      { scope: "campaign_lease", status: "locked" },
      { scope: "snapshot", status: "snapshot" },
    ]);
  });

  test("snapshots and campaign leases are never counted as sent emails, including old sent snapshot markers", async () => {
    const lease = await sender();
    await database
      .update(funnelEmailDeliveries)
      .set({ status: "sent" })
      .where(eq(funnelEmailDeliveries.scopeId, "snapshot"));
    expect([...(await store.sentScopes())]).toEqual([]);
    expect(await store.progress([recipient])).toEqual({
      pending: 1,
      sent: 0,
      busy: 0,
      retryable: 0,
      addressChanged: 0,
      reconciliationRequired: 0,
    });
    const claim = await store.claim(recipient, snapshot(), lease);
    if (claim.kind !== "claimed") throw new Error("Expected delivery");
    await store.finish(claim.scope, claim.metadata, lease, {
      kind: "sent",
      providerId: "real-email",
    });
    expect([...(await store.sentScopes())]).toEqual([
      recipientScope("participant@example.com"),
    ]);
    expect((await store.progress([recipient])).sent).toBe(1);
  });

  test("freezes the full snapshot and refuses content drift under the same campaign", async () => {
    const lease = await sender();
    const content = snapshot();
    await expect(
      store.freezeSnapshot(
        {
          ...content,
          content: { ...content.content, subject: "Changed after launch" },
        },
        lease,
      ),
    ).rejects.toThrow("snapshot changed");
    expect(await store.readSnapshot(content)).toBe(true);
  });

  test("a changed primary email cannot send a second announcement to the same account", async () => {
    const lease = await sender();
    const content = snapshot();
    const first = await store.claim(recipient, content, lease);
    if (first.kind !== "claimed") throw new Error("Expected first claim");
    await store.finish(first.scope, first.metadata, lease, {
      kind: "sent",
      providerId: "already-sent",
    });
    expect(
      await store.claim(
        { ...recipient, email: "fresh@example.com" },
        content,
        lease,
      ),
    ).toEqual({ kind: "duplicate" });
    expect((await targetRows()).map((row) => row.scopeId)).toEqual([
      recipientScope("participant@example.com"),
    ]);
    expect(
      (await store.progress([{ ...recipient, email: "fresh@example.com" }]))
        .sent,
    ).toBe(1);
  });

  test("a changed email cannot reset an uncertain account delivery or its retry window", async () => {
    const lease = await sender();
    const content = snapshot();
    const now = Date.now();
    const first = await store.claim(recipient, content, lease, now);
    if (first.kind !== "claimed") throw new Error("Expected first claim");
    await store.finish(first.scope, first.metadata, lease, { kind: "failed" });
    expect(
      await store.claim(
        { ...recipient, email: "fresh@example.com" },
        content,
        lease,
        now + 1_000,
      ),
    ).toEqual({ kind: "address_changed" });
    expect(
      await store.claim(
        { ...recipient, email: "fresh@example.com" },
        content,
        lease,
        now + 82_800_000,
      ),
    ).toEqual({ kind: "expired" });
    const targets = await targetRows();
    expect(targets).toHaveLength(1);
    const record: unknown = JSON.parse(targets[0]?.triggerRunId ?? "null");
    expect(record).toMatchObject({
      email: "participant@example.com",
      startedAt: now,
      payloadHash: digest(first.body),
    });
    expect(
      await store.progress(
        [{ ...recipient, email: "fresh@example.com" }],
        now + 82_800_000,
      ),
    ).toEqual({
      pending: 0,
      sent: 0,
      busy: 0,
      retryable: 0,
      addressChanged: 0,
      reconciliationRequired: 1,
    });
  });

  test("concurrent claims for one account at two addresses create exactly one immutable target", async () => {
    const lease = await sender();
    const claims = await Promise.all([
      store.claim(recipient, snapshot(), lease),
      store.claim(
        { ...recipient, email: "fresh@example.com" },
        snapshot(),
        lease,
      ),
    ]);
    expect(claims.map((claim) => claim.kind).sort()).toEqual([
      "address_changed",
      "claimed",
    ]);
    expect(await targetRows()).toHaveLength(1);
    const rows = await database.select().from(funnelEmailDeliveries);
    expect(
      rows.filter((row) => row.scopeId.startsWith("account/")),
    ).toHaveLength(1);
    const claimed = claims.find((claim) => claim.kind === "claimed");
    if (claimed?.kind !== "claimed")
      throw new Error("Expected one claimed target");
    const reserved: unknown = JSON.parse(
      rows.find((row) => row.scopeId === accountScope(recipient.clerkUserId))
        ?.triggerRunId ?? "null",
    );
    expect(reserved).toMatchObject({
      email: claimed.metadata.email,
      deliveryScope: claimed.scope,
    });
  });

  test("shared-address accounts remain deduplicated, and each account permanently retains that original target", async () => {
    const lease = await sender();
    const alias = { ...recipient, clerkUserId: "another-user" };
    const claims = await Promise.all([
      store.claim(recipient, snapshot(), lease),
      store.claim(alias, snapshot(), lease),
    ]);
    expect(claims.map((claim) => claim.kind).sort()).toEqual([
      "busy",
      "claimed",
    ]);
    const claimed = claims.find((claim) => claim.kind === "claimed");
    if (claimed?.kind !== "claimed") throw new Error("Expected one delivery");
    await store.finish(claimed.scope, claimed.metadata, lease, {
      kind: "sent",
      providerId: "one-mailbox-email",
    });
    expect(
      await store.claim(
        { ...alias, email: "fresh@example.com" },
        snapshot(),
        lease,
      ),
    ).toEqual({ kind: "duplicate" });
    expect(await targetRows()).toHaveLength(1);
    const rows = await database.select().from(funnelEmailDeliveries);
    expect(
      rows.filter((row) => row.scopeId.startsWith("account/")),
    ).toHaveLength(2);
    expect(await store.progress([recipient, alias])).toEqual({
      pending: 0,
      sent: 1,
      busy: 0,
      retryable: 0,
      addressChanged: 0,
      reconciliationRequired: 0,
    });
  });

  test("binds all accounts including aliases before the first batch, without starting provider retry windows", async () => {
    const lease = await sender();
    const alias = { ...recipient, clerkUserId: "alias-user" };
    await store.bindAccounts([recipient, alias], snapshot().contentHash, lease);
    expect(
      await store.claim(
        { ...alias, email: "fresh@example.com" },
        snapshot(),
        lease,
      ),
    ).toEqual({ kind: "address_changed" });
    expect(await targetRows()).toEqual([]);
    expect(
      await store.progress([{ ...alias, email: "fresh@example.com" }]),
    ).toEqual({
      pending: 0,
      sent: 0,
      busy: 0,
      retryable: 0,
      addressChanged: 1,
      reconciliationRequired: 0,
    });
    const claimed = await store.claim(recipient, snapshot(), lease);
    expect(claimed.kind).toBe("claimed");
    expect(await targetRows()).toHaveLength(1);
  });

  test("bulk reservations span bounded chunks without replacing any account's chosen email", async () => {
    const lease = await sender();
    const accounts = Array.from({ length: 101 }, (_, index) => ({
      clerkUserId: `user-${index}`,
      email: `user-${index}@example.com`,
    }));
    await store.bindAccounts(accounts, snapshot().contentHash, lease);
    await store.bindAccounts(
      [{ clerkUserId: "user-100", email: "replacement@example.com" }],
      snapshot().contentHash,
      lease,
    );
    const rows = await database.select().from(funnelEmailDeliveries);
    expect(
      rows.filter((row) => row.scopeId.startsWith("account/")),
    ).toHaveLength(101);
    expect(await targetRows()).toEqual([]);
    expect(
      await store.claim(
        { clerkUserId: "user-100", email: "replacement@example.com" },
        snapshot(),
        lease,
      ),
    ).toEqual({ kind: "address_changed" });
    expect(
      (
        await store.claim(
          { clerkUserId: "user-100", email: "user-100@example.com" },
          snapshot(),
          lease,
        )
      ).kind,
    ).toBe("claimed");
  });

  test("account and email creation roll back together if the email insert fails", async () => {
    const lease = await sender();
    await pg.exec(`CREATE FUNCTION reject_email() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.scope_id LIKE 'recipient/%' THEN RAISE EXCEPTION 'simulated database failure'; END IF;
      RETURN NEW; END $$;
      CREATE TRIGGER reject_email BEFORE INSERT ON funnel_email_deliveries FOR EACH ROW EXECUTE FUNCTION reject_email();`);
    await expect(store.claim(recipient, snapshot(), lease)).rejects.toThrow();
    const rows = await database.select().from(funnelEmailDeliveries);
    expect(
      rows.filter(
        (row) =>
          row.scopeId.startsWith("account/") ||
          row.scopeId.startsWith("recipient/"),
      ),
    ).toEqual([]);
    await pg.exec("DROP TRIGGER reject_email ON funnel_email_deliveries;");
    expect((await store.claim(recipient, snapshot(), lease)).kind).toBe(
      "claimed",
    );
  });

  test("concurrent campaign owners produce one winner even when they intend different recipients", async () => {
    const owners = await Promise.all([
      store.acquireLease(),
      store.acquireLease(),
    ]);
    expect(owners.map((owner) => owner.kind).sort()).toEqual([
      "acquired",
      "busy",
    ]);
    const winner = owners.find((owner) => owner.kind === "acquired");
    if (winner?.kind !== "acquired")
      throw new Error("Expected one campaign owner");
    await store.freezeSnapshot(snapshot(), winner.lease);
    expect(
      await store.claim(recipient, snapshot(), winner.lease),
    ).toMatchObject({ kind: "claimed" });
    await expect(
      store.claim(
        { clerkUserId: "other-user", email: "other@example.com" },
        snapshot(),
        { token: "not-the-owner" },
      ),
    ).rejects.toThrow("owner lease");
    expect(await targetRows()).toHaveLength(1);
  });

  test("expired owners cannot resurrect, mutate snapshots or reserve a new address before or after takeover", async () => {
    const old = await acquire();
    await expireOwner();
    await expect(store.heartbeat(old)).rejects.toThrow("owner lease");
    await expect(store.freezeSnapshot(snapshot(), old)).rejects.toThrow(
      "owner lease",
    );
    await expect(
      store.bindAccounts([recipient], snapshot().contentHash, old),
    ).rejects.toThrow("owner lease");
    const current = await acquire();
    expect(current.token).not.toBe(old.token);
    expect(await store.releaseLease(old)).toBe(false);
    await expect(store.claim(recipient, snapshot(), old)).rejects.toThrow(
      "owner lease",
    );
    await store.freezeSnapshot(snapshot(), current);
    expect((await store.claim(recipient, snapshot(), current)).kind).toBe(
      "claimed",
    );
    expect(await targetRows()).toHaveLength(1);
  });

  test("heartbeat extends ownership and release is fenced and idempotent", async () => {
    const lease = await acquire();
    await database
      .update(funnelEmailDeliveries)
      .set({ updatedAt: new Date(Date.now() - leaseMs + 10_000) })
      .where(eq(funnelEmailDeliveries.scopeId, "campaign_lease"));
    await store.heartbeat(lease);
    expect(await store.acquireLease()).toEqual({ kind: "busy" });
    expect(await store.releaseLease(lease)).toBe(true);
    expect(await store.releaseLease(lease)).toBe(false);
    expect((await store.acquireLease()).kind).toBe("acquired");
  });

  test("a delayed heartbeat acknowledgement cannot authorize a provider attempt using stale lease evidence", async () => {
    const lease = await acquire();
    let elapsed = 0;
    const delayed = createDeliveryStore(database, () => {
      const current = elapsed;
      elapsed += leaseMs;
      return current;
    });
    await expect(delayed.heartbeat(lease)).rejects.toThrow(
      "acknowledgement arrived too late",
    );
    expect(await store.acquireLease()).toEqual({ kind: "busy" });
    expect(await targetRows()).toEqual([]);
  });

  test("crash recovery retains an uncertain original address, timestamp and payload under a new campaign owner", async () => {
    const old = await sender();
    const now = Date.now();
    const first = await store.claim(recipient, snapshot(), old, now);
    if (first.kind !== "claimed") throw new Error("Expected first claim");
    await expireOwner();
    const current = await acquire();
    await expect(
      store.finish(first.scope, first.metadata, old, {
        kind: "sent",
        providerId: "stale-acceptance",
      }),
    ).rejects.toThrow("owner lease");
    expect(
      await store.claim(
        { ...recipient, email: "fresh@example.com" },
        snapshot(),
        current,
        now + leaseMs,
      ),
    ).toEqual({ kind: "address_changed" });
    const resumed = await store.claim(
      recipient,
      snapshot(),
      current,
      now + leaseMs,
    );
    if (resumed.kind !== "claimed")
      throw new Error("Expected original-target recovery");
    expect(resumed.body).toBe(first.body);
    expect(resumed.metadata).toMatchObject({
      email: "participant@example.com",
      startedAt: now,
    });
    expect(
      await store.claim(recipient, snapshot(), current, now + 82_800_000),
    ).toEqual({ kind: "expired" });
    expect(await targetRows()).toHaveLength(1);
  });

  test("a stale delivery receipt cannot overwrite a newer claim even while the campaign owner is unchanged", async () => {
    const lease = await sender();
    const now = Date.now();
    const first = await store.claim(recipient, snapshot(), lease, now);
    if (first.kind !== "claimed") throw new Error("Expected first claim");
    const resumed = await store.claim(
      recipient,
      snapshot(),
      lease,
      now + leaseMs,
    );
    if (resumed.kind !== "claimed")
      throw new Error("Expected original-target retry");
    await expect(
      store.finish(first.scope, first.metadata, lease, {
        kind: "sent",
        providerId: "old-worker-id",
      }),
    ).rejects.toThrow("Delivery lease changed");
    await store.finish(resumed.scope, resumed.metadata, lease, {
      kind: "sent",
      providerId: "one-idempotent-email",
    });
    expect(
      await store.claim(
        { ...recipient, email: "fresh@example.com" },
        snapshot(),
        lease,
      ),
    ).toEqual({ kind: "duplicate" });
  });
});
