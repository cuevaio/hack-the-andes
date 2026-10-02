import { describe, expect, test } from "bun:test";
import type { ChallengeCatalogResponse } from "@chofex/challenges-contract";
import { challengeCatalog } from "@chofex/challenges-contract";
import { buildSlowServiceAnnouncement } from "../../apps/web/lib/emails/slow-service-announcement";
import {
  type Account,
  assertCatalogLive,
  assertGuideLive,
  canonicalEmail,
  deliveryAction,
  digest,
  parseOptions,
  payloadFor,
  planRecipients,
  providerKey,
  recipientScope,
  snapshot,
  verifyLiveChallenge,
} from "./campaign";

export function account(id: string, email: string): Account {
  return {
    id,
    banned: false,
    locked: false,
    primary_email_address_id: "primary",
    email_addresses: [
      {
        id: "old",
        email_address: "historical@example.com",
        verification: { status: "verified" },
      },
      {
        id: "primary",
        email_address: email,
        verification: { status: "verified" },
      },
    ],
  };
}

export function liveCatalog(): ChallengeCatalogResponse {
  return {
    challenges: challengeCatalog.map((challenge) => ({
      ...challenge,
      playable: true,
      open: challenge.slug === "make-it-fast",
      closed: challenge.slug !== "make-it-fast",
      challengeVersion: "slow-service-v3",
      rankingPath: `/challenges/${challenge.slug}`,
    })),
  };
}
const guide =
  "<h1>The Slow Service</h1><p>Diario contable, slow-service-v3</p><pre>function createLedger({ accounts }) { return { amend(request) {}, report({ account, from, to, asOf, percentile }) {} }; }</pre><p>El reporte incluye debits y debitAmountAtPercentile.</p><code>chofex challenge init --challenge make-it-fast</code>";

describe("recipient policy", () => {
  test("includes all participants without using application status, excludes stale and unreachable profiles, deduplicates current emails", () => {
    const unverified = account("unverified", "unverified@example.com");
    const plan = planRecipients({
      participantUserIds: [
        "z-duplicate",
        "rejected",
        "draft",
        "accepted",
        "unsubscribed",
        "bounced",
        "unverified",
        "banned",
        "locked",
        "deleted",
      ],
      accounts: [
        account("rejected", " Rejected@EXAMPLE.COM "),
        account("draft", "draft@example.com"),
        account("accepted", "accepted@example.com"),
        account("z-duplicate", "DRAFT@example.com"),
        account("unsubscribed", "optout@example.com"),
        account("bounced", "bounce@example.com"),
        {
          ...unverified,
          email_addresses: unverified.email_addresses.map((entry) => ({
            ...entry,
            verification: { status: "unverified" },
          })),
        },
        { ...account("banned", "banned@example.com"), banned: true },
        { ...account("locked", "locked@example.com"), locked: true },
        account("not-registered", "not-registered@example.com"),
      ],
      contacts: [
        { id: "contact", email: " OptOut@EXAMPLE.com ", unsubscribed: true },
      ],
      emails: [],
      suppressions: [
        { id: "suppression", email: "BOUNCE@example.com", origin: "bounce" },
      ],
    });
    expect(plan.recipients).toEqual([
      { clerkUserId: "accepted", email: "accepted@example.com" },
      { clerkUserId: "draft", email: "draft@example.com" },
      { clerkUserId: "rejected", email: "rejected@example.com" },
    ]);
    expect(plan.recipientAccounts).toEqual([
      { clerkUserId: "accepted", email: "accepted@example.com" },
      { clerkUserId: "draft", email: "draft@example.com" },
      { clerkUserId: "rejected", email: "rejected@example.com" },
      { clerkUserId: "z-duplicate", email: "draft@example.com" },
    ]);
    expect(plan.totals).toEqual({
      participants: 10,
      missingAccount: 1,
      unreachableOrUnverified: 3,
      unsubscribed: 1,
      suppressed: 1,
      bouncedOrComplained: 0,
      duplicateEmail: 1,
      eligible: 3,
    });
  });
  test("never falls back to historical or secondary emails", () => {
    expect(canonicalEmail(account("user", " CURRENT@example.com "))).toBe(
      "current@example.com",
    );
    expect(
      canonicalEmail({
        ...account("user", "current@example.com"),
        primary_email_address_id: null,
      }),
    ).toBeUndefined();
  });
  test("suppresses complaints and manually suppressed recipients as well as bounces", () => {
    const plan = planRecipients({
      participantUserIds: ["ok", "complaint", "manual"],
      accounts: [
        account("ok", "ok@example.com"),
        account("complaint", "complaint@example.com"),
        account("manual", "manual@example.com"),
      ],
      contacts: [],
      emails: [],
      suppressions: [
        { id: "1", email: "complaint@example.com", origin: "complaint" },
        { id: "2", email: "manual@example.com", origin: "manual" },
      ],
    });
    expect(plan.recipients).toEqual([
      { clerkUserId: "ok", email: "ok@example.com" },
    ]);
    expect(plan.totals.suppressed).toBe(2);
  });
  test("excludes provider bounce, complaint and suppressed events even without a suppression record", () => {
    const plan = planRecipients({
      participantUserIds: ["ok", "bounced", "complained", "suppressed"],
      accounts: [
        account("ok", "ok@example.com"),
        account("bounced", "bounced@example.com"),
        account("complained", "complained@example.com"),
        account("suppressed", "suppressed@example.com"),
      ],
      contacts: [],
      suppressions: [],
      emails: [
        { id: "ok", to: ["ok@example.com"], last_event: "delivered" },
        { id: "bounce", to: ["BOUNCED@example.com"], last_event: "bounced" },
        {
          id: "complaint",
          to: ["complained@example.com"],
          last_event: "email.complained",
        },
        {
          id: "suppression",
          to: ["suppressed@example.com"],
          last_event: "suppressed",
        },
      ],
    });
    expect(plan.recipients).toEqual([
      { clerkUserId: "ok", email: "ok@example.com" },
    ]);
    expect(plan.totals.bouncedOrComplained).toBe(3);
  });
});

describe("live launch guard", () => {
  test("requires the exact live version, challenge 3 open/playable and challenge 2 closed", () => {
    assertCatalogLive(liveCatalog());
    const cases = [
      { slug: "make-it-fast", playable: false },
      { slug: "make-it-fast", open: false },
      { slug: "make-it-fast", closed: true },
      { slug: "make-it-fast", challengeVersion: "slow-service-v0" },
      { slug: "make-it-fast", challengeVersion: "slow-service-v1" },
      { slug: "make-it-fast", challengeVersion: "slow-service-v2" },
      { slug: "broken-agent", closed: false },
      { slug: "broken-agent", open: true },
    ];
    for (const change of cases) {
      const catalog = liveCatalog();
      expect(() =>
        assertCatalogLive({
          challenges: catalog.challenges.map((entry) =>
            entry.slug === change.slug
              ? { ...entry, ...change, slug: entry.slug }
              : entry,
          ),
        }),
      ).toThrow();
    }
    expect(() => assertCatalogLive({ challenges: [] })).toThrow();
    expect(() => assertGuideLive(200, guide)).not.toThrow();
    expect(() => assertGuideLive(404, guide)).toThrow();
    expect(() => assertGuideLive(200, "Próximamente")).toThrow();
    expect(() => assertGuideLive(200, `<script>${guide}</script>`)).toThrow();
    expect(() =>
      assertGuideLive(200, guide.replace("slow-service-v3", "slow-service-v2")),
    ).toThrow();
    expect(() =>
      assertGuideLive(
        200,
        guide
          .replace("amend(request)", "apply(mutation)")
          .replace("report({", "query({"),
      ),
    ).toThrow();
    for (const field of ["percentile", "debits", "debitAmountAtPercentile"]) {
      expect(() =>
        assertGuideLive(200, guide.replace(field, "legacy")),
      ).toThrow();
    }
  });
  test("checks the canonical catalog and CTA URL using read-only requests", async () => {
    const requests: {
      url: string;
      method: string;
      redirect: RequestRedirect | undefined;
    }[] = [];
    const fetcher: typeof fetch = Object.assign(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        requests.push({
          url,
          method: init?.method ?? "GET",
          redirect: init?.redirect,
        });
        if (url.endsWith("/api/v1/challenges"))
          return Response.json({
            version: 1,
            ok: true,
            requestId: "test",
            data: liveCatalog(),
          });
        return new Response(guide);
      },
      { preconnect: fetch.preconnect },
    );
    await verifyLiveChallenge(fetcher);
    expect(requests).toEqual([
      {
        url: "https://hacktheandes.com/api/v1/challenges",
        method: "GET",
        redirect: "error",
      },
      {
        url: "https://hacktheandes.com/challenges/make-it-fast?utm_source=resend&utm_medium=email&utm_campaign=slow-service-v3&utm_content=launch",
        method: "GET",
        redirect: "error",
      },
    ]);
  });
  test("dry-run is the default and sending needs both explicit flags", () => {
    expect(parseOptions([])).toEqual({
      mode: "dry-run",
      limit: 50,
    });
    expect(
      parseOptions(["--send", "--confirm-live-challenge", "--limit", "10"]),
    ).toEqual({ mode: "send", limit: 10 });
    for (const args of [
      ["--send"],
      ["--confirm-live-challenge"],
      ["--send", "--confirm-live-challenge", "--dry-run"],
      ["--send", "--confirm-live-challenge", "--preview"],
      ["--limit", "101"],
      ["--unknown"],
    ])
      expect(() => parseOptions(args)).toThrow();
  });
});

describe("content and idempotency", () => {
  test("requires the final frozen content fingerprint before any campaign can start", () => {
    const content = buildSlowServiceAnnouncement();
    expect(snapshot(content).contentHash).toBe(
      "137e13d2e53facf8f450b339508142eb9db1a9996459da5221bff7413eac1ca3",
    );
    expect(() =>
      snapshot({ ...content, subject: "Unreviewed announcement" }),
    ).toThrow("frozen content snapshot");
  });
  test("renders the branded Spanish guide email with one primary CTA, exact-results policy, AI permission and preserved history", () => {
    const email = buildSlowServiceAnnouncement();
    expect(email.subject).toBe(
      "El servicio lento: trabaja con tu agente y revisa la solución",
    );
    expect(email.html).toContain('<html lang="es">');
    expect(email.html).toContain("HACK THE ANDES");
    expect(email.html).toContain("/email/ridge-band.png");
    expect(email.html.match(/>Ver el challenge<\/a>/g)).toHaveLength(1);
    expect(email.text).toContain("Cada respuesta debe ser exacta.");
    expect(email.text).toContain("diario contable");
    expect(email.text).toContain("revisiones optimistas");
    expect(email.text).toContain("sin modificar nada");
    expect(email.text).toContain("reportes de estados anteriores");
    expect(email.text).toContain("saldos y la distribución de pagos");
    expect(email.text).toContain(
      "percentiles exactos de los importes de débito, las partidas negativas",
    );
    expect(email.text).toContain("Los créditos no entran en esa distribución.");
    expect(email.text).toContain(
      "Puede escribir todo el código y ejecutar los tests.",
    );
    expect(email.text).toContain("valida un caso concreto de falla");
    expect(email.text).toContain(
      "aprueba esa versión en tu navegador con tu passkey",
    );
    expect(email.text).toContain("Tu historial y su ranking se conservan.");
    expect(email.text).toContain(
      "chofex challenge init --challenge make-it-fast",
    );
    expect(email.html).toContain("Solicitar la baja de anuncios");
    expect(payloadFor(email, " RECIPIENT@Example.com ")).toEqual({
      ...email,
      to: ["recipient@example.com"],
    });
    expect("cc" in email).toBe(false);
    expect("bcc" in email).toBe(false);
  });
  test("uses normalized address keys rather than changing account IDs or content hashes", () => {
    expect(digest("recipient@example.com")).toBe(
      "5efba3df1c3be499380cf0c59ceda286171b90abc05cfac25b882fc4368b391c",
    );
    expect(providerKey(" RECIPIENT@EXAMPLE.COM ")).toBe(
      "challenge-launch/slow-service-v3/5efba3df1c3be499380cf0c59ceda286171b90abc05cfac25b882fc4368b391c",
    );
    expect(recipientScope(" RECIPIENT@EXAMPLE.COM ")).toBe(
      "recipient/5efba3df1c3be499380cf0c59ceda286171b90abc05cfac25b882fc4368b391c",
    );
    expect(snapshot().content.subject).toBe(
      "El servicio lento: trabaja con tu agente y revisa la solución",
    );
  });
  test("never retries sent or expired uncertain deliveries after the provider's 24-hour protection", () => {
    expect(
      deliveryAction({
        status: "sent",
        startedAt: 0,
        updatedAt: 0,
        now: 100_000_000,
      }),
    ).toBe("duplicate");
    expect(
      deliveryAction({
        status: "sending",
        startedAt: 0,
        updatedAt: 0,
        now: 1_000,
      }),
    ).toBe("busy");
    expect(
      deliveryAction({
        status: "failed",
        startedAt: 0,
        updatedAt: 0,
        now: 1_000,
      }),
    ).toBe("retry");
    expect(
      deliveryAction({
        status: "sending",
        startedAt: 0,
        updatedAt: 0,
        now: 120_000,
      }),
    ).toBe("retry");
    expect(
      deliveryAction({
        status: "failed",
        startedAt: 0,
        updatedAt: 0,
        now: 82_800_000,
      }),
    ).toBe("expired");
    expect(
      deliveryAction({
        status: "unknown",
        startedAt: 0,
        updatedAt: 0,
        now: 1_000,
      }),
    ).toBe("expired");
  });
});
