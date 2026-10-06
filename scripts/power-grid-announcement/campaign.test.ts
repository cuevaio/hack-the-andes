import { expect, test } from "bun:test";
import {
  challengeAdmissionNotice,
  challengeCatalog,
} from "@chofex/challenges-contract";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { snapshot as previousSnapshot } from "../slow-service-announcement/campaign";
import { createDeliveryStore } from "../slow-service-announcement/delivery";
import {
  campaignId,
  campaignStage,
  campaignUserId,
  parseOptions,
  providerKey,
  snapshot,
  verifyLiveChallenge,
} from "./campaign";

const fetcher = (open: boolean) => async (input: RequestInfo | URL) => {
  if (String(input).includes("/api/v1/challenges"))
    return Response.json({
      version: 1,
      ok: true,
      requestId: "local-catalog",
      data: {
        admission: {
          challengesMandatory: true,
          selectionBasis: "challenge_rankings",
          notice: challengeAdmissionNotice,
        },
        challenges: challengeCatalog.map((item) => ({
          ...item,
          open: item.slug === "power-grid" && open,
          playable: item.slug === "power-grid" || item.playable,
          closed: item.slug === "make-it-fast",
          challengeVersion:
            item.slug === "power-grid" ? "power-grid-v1" : "other",
          rankingPath: `/challenges/${item.slug}`,
        })),
      },
    });
  return new Response(
    "<p>calculateBill(input)</p><pre>andes challenge init --challenge power-grid</pre>",
  );
};

test("invitation is blocked until the public catalog is actually open", async () => {
  await expect(verifyLiveChallenge(fetcher(false))).rejects.toThrow(
    "publicly open",
  );
  await expect(verifyLiveChallenge(fetcher(true))).resolves.toBeUndefined();
});

test("Power Grid deliveries cannot conflict with earlier announcement receipts", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE TABLE funnel_email_deliveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clerk_user_id varchar(255) NOT NULL,
      stage varchar(32) NOT NULL, scope_id varchar(255) NOT NULL, status varchar(16) NOT NULL DEFAULT 'sending',
      trigger_run_id text NOT NULL, sent_at timestamptz, error text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (clerk_user_id, stage, scope_id)
    );`);
    const db = drizzle(pg);
    const previous = createDeliveryStore(db);
    const current = createDeliveryStore(db, () => performance.now(), {
      id: campaignId,
      userId: campaignUserId,
      stage: campaignStage,
    });
    const recipient = { clerkUserId: "one-account", email: "one@example.com" };
    for (const [store, content] of [
      [previous, previousSnapshot()],
      [current, snapshot()],
    ] satisfies [
      ReturnType<typeof createDeliveryStore>,
      ReturnType<typeof snapshot>,
    ][]) {
      const ownership = await store.acquireLease();
      if (ownership.kind !== "acquired")
        throw new Error("Expected independent campaign lease");
      await store.freezeSnapshot(content, ownership.lease);
      const claim = await store.claim(recipient, content, ownership.lease);
      if (claim.kind !== "claimed")
        throw new Error("Expected independent campaign delivery");
      await store.finish(claim.scope, claim.metadata, ownership.lease, {
        kind: "sent",
        providerId: "provider-id",
      });
      expect((await store.progress([recipient])).sent).toBe(1);
      expect(
        (await store.claim(recipient, content, ownership.lease)).kind,
      ).toBe("duplicate");
      await store.releaseLease(ownership.lease);
    }
    expect(providerKey(recipient.email)).not.toContain("slow-service");
  } finally {
    await pg.close();
  }
});

test("a single invitation batch still requires both send flags and has a bounded limit", () => {
  expect(
    parseOptions(["--send", "--confirm-live-challenge", "--limit", "500"]),
  ).toEqual({ mode: "send", limit: 500 });
  expect(() => parseOptions(["--send", "--limit", "500"])).toThrow("requires");
  expect(() =>
    parseOptions(["--send", "--confirm-live-challenge", "--limit", "501"]),
  ).toThrow("between 1 and 500");
});
