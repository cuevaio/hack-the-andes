import { randomUUID } from "node:crypto";
import { and, eq, gt, or, sql } from "@chofex/db/orm";
import { funnelEmailDeliveries } from "@chofex/db/schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Schema } from "effect";
import {
  AnnouncementError,
  accountScope,
  campaignId,
  campaignStage,
  campaignUserId,
  decode,
  deliveryAction,
  digest,
  leaseMs,
  normalizeEmail,
  payloadFor,
  recipientScope,
  type Snapshot,
} from "./campaign";

export type CampaignLease = { readonly token: string };
export type Recipient = {
  readonly clerkUserId: string;
  readonly email: string;
};
const AccountReservationSchema = Schema.Struct({
  kind: Schema.Literal("account_reservation"),
  clerkUserId: Schema.String,
  email: Schema.String,
  deliveryScope: Schema.String,
  contentHash: Schema.String,
});
const DeliveryMetadataSchema = Schema.Struct({
  kind: Schema.Literal("delivery"),
  contentHash: Schema.String,
  payloadHash: Schema.String,
  clerkUserId: Schema.String,
  email: Schema.String,
  startedAt: Schema.Int,
  leaseToken: Schema.String,
  providerId: Schema.optional(Schema.String),
});
export type DeliveryMetadata = typeof DeliveryMetadataSchema.Type;

const campaignWhere = and(
  eq(funnelEmailDeliveries.clerkUserId, campaignUserId),
  eq(funnelEmailDeliveries.stage, campaignStage),
);
const scopeWhere = (scope: string) =>
  and(campaignWhere, eq(funnelEmailDeliveries.scopeId, scope));
const leaseValue = (lease: CampaignLease) =>
  JSON.stringify({ kind: "campaign_lease", token: lease.token });
const activeSince = sql`clock_timestamp() - (${leaseMs} * interval '1 millisecond')`;
const leaseWhere = (lease: CampaignLease) =>
  and(
    scopeWhere("campaign_lease"),
    eq(funnelEmailDeliveries.status, "locked"),
    eq(funnelEmailDeliveries.triggerRunId, leaseValue(lease)),
    gt(funnelEmailDeliveries.updatedAt, activeSince),
  );
// The Neon HTTP driver has no interactive transactions. Keep ownership checks
// and account/email changes in one PostgreSQL statement.
const ownerGuard = (lease: CampaignLease) => sql`
  SELECT id FROM ${funnelEmailDeliveries}
  WHERE clerk_user_id = ${campaignUserId} AND stage = ${campaignStage}
    AND scope_id = 'campaign_lease' AND status = 'locked'
    AND trigger_run_id = ${leaseValue(lease)} AND updated_at > ${activeSince}
  FOR UPDATE`;

function stored<S extends Schema.Top & { readonly DecodingServices: never }>(
  schema: S,
  value: string,
): S["Type"] {
  try {
    return decode(schema, JSON.parse(value), "Stored campaign record");
  } catch {
    throw new AnnouncementError(
      "Stored campaign metadata is invalid; manual reconciliation required",
    );
  }
}
function reservationFor(recipient: Recipient, contentHash: string) {
  const email = normalizeEmail(recipient.email);
  return {
    kind: "account_reservation",
    clerkUserId: recipient.clerkUserId,
    email,
    deliveryScope: recipientScope(email),
    contentHash,
  } satisfies typeof AccountReservationSchema.Type;
}
function fencedResult(result: unknown) {
  const decoded = decode(
    Schema.Struct({
      rows: Schema.Array(
        Schema.Struct({ fenced: Schema.Boolean, applied: Schema.Boolean }),
      ),
    }),
    result,
    "Campaign write",
  );
  const row = decoded.rows[0];
  if (!row?.fenced)
    throw new AnnouncementError(
      "Campaign owner lease expired or changed; refusing to continue",
    );
  return row.applied;
}

export function createDeliveryStore(
  database: Pick<
    PgDatabase<PgQueryResultHKT>,
    "select" | "insert" | "update" | "execute"
  >,
  monotonicNow: () => number = () => performance.now(),
) {
  async function heartbeat(lease: CampaignLease) {
    const started = monotonicNow();
    const [updated] = await database
      .update(funnelEmailDeliveries)
      .set({ updatedAt: sql`clock_timestamp()` })
      .where(leaseWhere(lease))
      .returning({ id: funnelEmailDeliveries.id });
    if (!updated)
      throw new AnnouncementError(
        "Campaign owner lease expired or changed; refusing to continue",
      );
    if (monotonicNow() - started >= leaseMs / 2) {
      throw new AnnouncementError(
        "Campaign heartbeat acknowledgement arrived too late; refusing further provider requests",
      );
    }
  }
  async function readSnapshot(snapshot: Snapshot) {
    const [row] = await database
      .select()
      .from(funnelEmailDeliveries)
      .where(scopeWhere("snapshot"))
      .limit(1);
    if (
      row &&
      row.triggerRunId !==
        JSON.stringify({ kind: "snapshot", campaignId, ...snapshot })
    ) {
      throw new AnnouncementError(
        "Campaign content snapshot changed; restore the original content before resuming",
      );
    }
    return Boolean(row);
  }
  return {
    readSnapshot,
    heartbeat,
    async acquireLease() {
      const lease = { token: randomUUID() };
      const [claimed] = await database
        .insert(funnelEmailDeliveries)
        .values({
          clerkUserId: campaignUserId,
          stage: campaignStage,
          scopeId: "campaign_lease",
          status: "locked",
          triggerRunId: leaseValue(lease),
          updatedAt: sql`clock_timestamp()`,
        })
        .onConflictDoUpdate({
          target: [
            funnelEmailDeliveries.clerkUserId,
            funnelEmailDeliveries.stage,
            funnelEmailDeliveries.scopeId,
          ],
          set: {
            status: "locked",
            triggerRunId: leaseValue(lease),
            updatedAt: sql`clock_timestamp()`,
          },
          setWhere: or(
            eq(funnelEmailDeliveries.status, "idle"),
            sql`${funnelEmailDeliveries.updatedAt} <= ${activeSince}`,
          ),
        })
        .returning({ id: funnelEmailDeliveries.id });
      if (!claimed) return { kind: "busy" } as const;
      return { kind: "acquired", lease } as const;
    },
    async releaseLease(lease: CampaignLease) {
      const [released] = await database
        .update(funnelEmailDeliveries)
        .set({ status: "idle", updatedAt: sql`clock_timestamp()` })
        .where(
          and(
            scopeWhere("campaign_lease"),
            eq(funnelEmailDeliveries.triggerRunId, leaseValue(lease)),
            eq(funnelEmailDeliveries.status, "locked"),
          ),
        )
        .returning({ id: funnelEmailDeliveries.id });
      return Boolean(released);
    },
    async freezeSnapshot(snapshot: Snapshot, lease: CampaignLease) {
      const value = JSON.stringify({
        kind: "snapshot",
        campaignId,
        ...snapshot,
      });
      fencedResult(
        await database.execute(sql`
        WITH owner AS (${ownerGuard(lease)}), inserted AS (
          INSERT INTO ${funnelEmailDeliveries} (clerk_user_id, stage, scope_id, status, trigger_run_id)
          SELECT ${campaignUserId}, ${campaignStage}, 'snapshot', 'snapshot', ${value} FROM owner
          ON CONFLICT (clerk_user_id, stage, scope_id) DO NOTHING RETURNING id
        ) SELECT EXISTS(SELECT FROM owner) AS fenced, EXISTS(SELECT FROM inserted) AS applied`),
      );
      await readSnapshot(snapshot);
    },
    async bindAccounts(
      recipients: readonly Recipient[],
      contentHash: string,
      lease: CampaignLease,
    ) {
      for (let offset = 0; offset < recipients.length; offset += 100) {
        const values = recipients
          .slice(offset, offset + 100)
          .map(
            (recipient) =>
              sql`(${accountScope(recipient.clerkUserId)}, ${JSON.stringify(reservationFor(recipient, contentHash))})`,
          );
        fencedResult(
          await database.execute(sql`
          WITH owner AS (${ownerGuard(lease)}), inserted AS (
            INSERT INTO ${funnelEmailDeliveries} (clerk_user_id, stage, scope_id, status, trigger_run_id)
            SELECT ${campaignUserId}, ${campaignStage}, binding.scope, 'reserved', binding.metadata
            FROM (VALUES ${sql.join(values, sql`, `)}) AS binding(scope, metadata) CROSS JOIN owner
            ON CONFLICT (clerk_user_id, stage, scope_id) DO NOTHING RETURNING id
          ) SELECT EXISTS(SELECT FROM owner) AS fenced, EXISTS(SELECT FROM inserted) AS applied`),
        );
        await heartbeat(lease);
      }
    },
    async sentScopes() {
      const rows = await database
        .select({ scope: funnelEmailDeliveries.scopeId })
        .from(funnelEmailDeliveries)
        .where(
          and(
            campaignWhere,
            eq(funnelEmailDeliveries.status, "sent"),
            sql`${funnelEmailDeliveries.scopeId} LIKE 'recipient/%'`,
          ),
        );
      return new Set(rows.map((row) => row.scope));
    },
    async progress(recipients: readonly Recipient[], now = Date.now()) {
      const rows = await database
        .select()
        .from(funnelEmailDeliveries)
        .where(campaignWhere);
      const existing = new Map(rows.map((row) => [row.scopeId, row]));
      const seen = new Set<string>();
      const totals = {
        pending: 0,
        sent: 0,
        busy: 0,
        retryable: 0,
        addressChanged: 0,
        reconciliationRequired: 0,
      };
      for (const recipient of recipients) {
        const account = existing.get(accountScope(recipient.clerkUserId));
        let scope = recipientScope(recipient.email);
        let changed = false;
        if (account) {
          const binding = stored(
            AccountReservationSchema,
            account.triggerRunId,
          );
          scope = binding.deliveryScope;
          changed = binding.email !== normalizeEmail(recipient.email);
        }
        if (seen.has(scope)) continue;
        seen.add(scope);
        const row = existing.get(scope);
        if (!row) {
          if (changed) totals.addressChanged++;
          else totals.pending++;
          continue;
        }
        const metadata = stored(DeliveryMetadataSchema, row.triggerRunId);
        const action = deliveryAction({
          status: row.status,
          startedAt: metadata.startedAt,
          updatedAt: row.updatedAt.getTime(),
          now,
        });
        if (action === "duplicate") totals.sent++;
        else if (action === "expired") totals.reconciliationRequired++;
        else if (changed) totals.addressChanged++;
        else if (action === "busy") totals.busy++;
        else totals.retryable++;
      }
      return totals;
    },
    async claim(
      recipient: Recipient,
      snapshot: Snapshot,
      lease: CampaignLease,
      now = Date.now(),
    ) {
      const binding = reservationFor(recipient, snapshot.contentHash);
      const scope = binding.deliveryScope;
      const body = JSON.stringify(payloadFor(snapshot.content, binding.email));
      const fresh: DeliveryMetadata = {
        kind: "delivery",
        clerkUserId: recipient.clerkUserId,
        email: binding.email,
        contentHash: snapshot.contentHash,
        payloadHash: digest(body),
        startedAt: now,
        leaseToken: randomUUID(),
      };
      const created = fencedResult(
        await database.execute(sql`
        WITH owner AS (${ownerGuard(lease)}), account_insert AS (
          INSERT INTO ${funnelEmailDeliveries} (clerk_user_id, stage, scope_id, status, trigger_run_id)
          SELECT ${campaignUserId}, ${campaignStage}, ${accountScope(recipient.clerkUserId)}, 'reserved', ${JSON.stringify(binding)} FROM owner
          ON CONFLICT (clerk_user_id, stage, scope_id) DO NOTHING RETURNING trigger_run_id
        ), binding AS (
          SELECT trigger_run_id FROM account_insert
          UNION ALL SELECT trigger_run_id FROM ${funnelEmailDeliveries}
          WHERE clerk_user_id = ${campaignUserId} AND stage = ${campaignStage} AND scope_id = ${accountScope(recipient.clerkUserId)}
        ), inserted AS (
          INSERT INTO ${funnelEmailDeliveries} (clerk_user_id, stage, scope_id, status, trigger_run_id, updated_at)
          SELECT ${campaignUserId}, ${campaignStage}, ${scope}, 'sending', ${JSON.stringify(fresh)}, ${new Date(now)}
          FROM binding CROSS JOIN owner
          WHERE binding.trigger_run_id::jsonb ->> 'email' = ${binding.email}
            AND binding.trigger_run_id::jsonb ->> 'deliveryScope' = ${scope}
            AND binding.trigger_run_id::jsonb ->> 'contentHash' = ${snapshot.contentHash}
          ON CONFLICT (clerk_user_id, stage, scope_id) DO NOTHING RETURNING id
        ) SELECT EXISTS(SELECT FROM owner) AS fenced, EXISTS(SELECT FROM inserted) AS applied`),
      );
      if (created)
        return { kind: "claimed", scope, body, metadata: fresh } as const;
      const [account] = await database
        .select()
        .from(funnelEmailDeliveries)
        .where(scopeWhere(accountScope(recipient.clerkUserId)))
        .limit(1);
      if (!account)
        throw new AnnouncementError(
          "Account reservation disappeared; refusing to send",
        );
      const chosen = stored(AccountReservationSchema, account.triggerRunId);
      if (chosen.contentHash !== snapshot.contentHash)
        throw new AnnouncementError(
          "Account content snapshot changed; refusing to send",
        );
      const [existing] = await database
        .select()
        .from(funnelEmailDeliveries)
        .where(scopeWhere(chosen.deliveryScope))
        .limit(1);
      if (!existing) {
        if (chosen.email !== binding.email)
          return { kind: "address_changed" } as const;
        throw new AnnouncementError(
          "Delivery disappeared; manual reconciliation required",
        );
      }
      const metadata = stored(DeliveryMetadataSchema, existing.triggerRunId);
      const action = deliveryAction({
        status: existing.status,
        startedAt: metadata.startedAt,
        updatedAt: existing.updatedAt.getTime(),
        now,
      });
      if (action === "duplicate" || action === "expired")
        return { kind: action } as const;
      if (chosen.email !== binding.email)
        return { kind: "address_changed" } as const;
      if (
        metadata.contentHash !== snapshot.contentHash ||
        metadata.payloadHash !== digest(body) ||
        metadata.email !== binding.email
      )
        throw new AnnouncementError(
          "Recipient payload changed; refusing to resend",
        );
      if (action === "busy") return { kind: "busy" } as const;
      const reclaimed = { ...metadata, leaseToken: randomUUID() };
      const updated = fencedResult(
        await database.execute(sql`
        WITH owner AS (${ownerGuard(lease)}), updated AS (
          UPDATE ${funnelEmailDeliveries} SET status = 'sending', trigger_run_id = ${JSON.stringify(reclaimed)}, error = NULL, updated_at = ${new Date(now)}
          FROM owner WHERE clerk_user_id = ${campaignUserId} AND stage = ${campaignStage} AND scope_id = ${chosen.deliveryScope}
            AND trigger_run_id = ${existing.triggerRunId} AND status = ${existing.status} RETURNING ${funnelEmailDeliveries.id}
        ) SELECT EXISTS(SELECT FROM owner) AS fenced, EXISTS(SELECT FROM updated) AS applied`),
      );
      if (!updated) return { kind: "busy" } as const;
      return {
        kind: "claimed",
        scope: chosen.deliveryScope,
        body,
        metadata: reclaimed,
      } as const;
    },
    async finish(
      scope: string,
      metadata: DeliveryMetadata,
      lease: CampaignLease,
      result: { kind: "sent"; providerId: string } | { kind: "failed" },
    ) {
      let next = JSON.stringify(metadata);
      let sentAt: Date | null = null;
      let error: string | null =
        "Provider outcome uncertain; retry only within the idempotency window";
      let status = "failed";
      if (result.kind === "sent") {
        next = JSON.stringify({ ...metadata, providerId: result.providerId });
        sentAt = new Date();
        error = null;
        status = "sent";
      }
      const updated = fencedResult(
        await database.execute(sql`
        WITH owner AS (${ownerGuard(lease)}), updated AS (
          UPDATE ${funnelEmailDeliveries} SET status = ${status}, trigger_run_id = ${next}, sent_at = ${sentAt}, error = ${error}, updated_at = clock_timestamp()
          FROM owner WHERE clerk_user_id = ${campaignUserId} AND stage = ${campaignStage} AND scope_id = ${scope}
            AND trigger_run_id = ${JSON.stringify(metadata)} AND status = 'sending' RETURNING ${funnelEmailDeliveries.id}
        ) SELECT EXISTS(SELECT FROM owner) AS fenced, EXISTS(SELECT FROM updated) AS applied`),
      );
      if (!updated)
        throw new AnnouncementError(
          "Delivery lease changed; resume to reconcile, do not create a new campaign",
        );
    },
  };
}
