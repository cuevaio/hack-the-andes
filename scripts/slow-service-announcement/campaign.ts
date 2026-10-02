import { createHash } from "node:crypto";
import {
  type ChallengeCatalogResponse,
  ChallengeCatalogSchema,
} from "@chofex/challenges-contract";
import { ApiSuccessSchema } from "@chofex/registration-contract";
import { Schema } from "effect";
import {
  buildSlowServiceAnnouncement,
  slowServiceCampaign,
  slowServiceGuideUrl,
  slowServiceInitCommand,
} from "../../apps/web/lib/emails/slow-service-announcement";

export const campaignId = `challenge-launch/${slowServiceCampaign}`;
export const campaignUserId = `campaign:${slowServiceCampaign}`;
export const campaignStage = "challenge_announcement";
export const retryWindowMs = 23 * 60 * 60 * 1_000;
export const leaseMs = 2 * 60 * 1_000;
export const frozenContentHash =
  "137e13d2e53facf8f450b339508142eb9db1a9996459da5221bff7413eac1ca3";

export class AnnouncementError extends Error {}

export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const recipientScope = (email: string) =>
  `recipient/${digest(normalizeEmail(email))}`;
export const accountScope = (clerkUserId: string) =>
  `account/${digest(clerkUserId)}`;
export const providerKey = (email: string) =>
  `${campaignId}/${digest(normalizeEmail(email))}`;

export const AccountSchema = Schema.Struct({
  id: Schema.String,
  banned: Schema.Boolean,
  locked: Schema.Boolean,
  primary_email_address_id: Schema.NullOr(Schema.String),
  email_addresses: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      email_address: Schema.String,
      verification: Schema.NullOr(Schema.Struct({ status: Schema.String })),
    }),
  ),
});
export type Account = typeof AccountSchema.Type;
export const ContactSchema = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  unsubscribed: Schema.Boolean,
});
export const SuppressionSchema = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  origin: Schema.Literals(["bounce", "complaint", "manual"]),
});
export const SentEmailSchema = Schema.Struct({
  id: Schema.String,
  to: Schema.Array(Schema.String),
  last_event: Schema.NullOr(Schema.String),
});

export function canonicalEmail(account: Account): string | undefined {
  if (account.banned || account.locked) return;
  const primary = account.email_addresses.find(
    (entry) => entry.id === account.primary_email_address_id,
  );
  if (primary?.verification?.status !== "verified") return;
  const email = normalizeEmail(primary.email_address);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  return email;
}

export function planRecipients(input: {
  participantUserIds: readonly string[];
  accounts: readonly Account[];
  contacts: readonly (typeof ContactSchema.Type)[];
  suppressions: readonly (typeof SuppressionSchema.Type)[];
  emails: readonly (typeof SentEmailSchema.Type)[];
}) {
  const accounts = new Map(
    input.accounts.map((account) => [account.id, account]),
  );
  const unsubscribed = new Set(
    input.contacts
      .filter((entry) => entry.unsubscribed)
      .map((entry) => normalizeEmail(entry.email)),
  );
  const suppressed = new Set(
    input.suppressions.map((entry) => normalizeEmail(entry.email)),
  );
  const bouncedOrComplained = new Set(
    input.emails
      .filter((entry) =>
        ["bounced", "complained", "suppressed"].includes(
          entry.last_event?.replace(/^email\./, "") ?? "",
        ),
      )
      .flatMap((entry) => entry.to.map(normalizeEmail)),
  );
  const recipients: { clerkUserId: string; email: string }[] = [];
  const recipientAccounts: { clerkUserId: string; email: string }[] = [];
  const seen = new Set<string>();
  const totals = {
    participants: input.participantUserIds.length,
    missingAccount: 0,
    unreachableOrUnverified: 0,
    unsubscribed: 0,
    suppressed: 0,
    bouncedOrComplained: 0,
    duplicateEmail: 0,
    eligible: 0,
  };
  for (const clerkUserId of [...input.participantUserIds].sort()) {
    const account = accounts.get(clerkUserId);
    if (!account) {
      totals.missingAccount++;
      continue;
    }
    const email = canonicalEmail(account);
    if (!email) {
      totals.unreachableOrUnverified++;
      continue;
    }
    if (unsubscribed.has(email)) {
      totals.unsubscribed++;
      continue;
    }
    if (suppressed.has(email)) {
      totals.suppressed++;
      continue;
    }
    if (bouncedOrComplained.has(email)) {
      totals.bouncedOrComplained++;
      continue;
    }
    recipientAccounts.push({ clerkUserId, email });
    if (seen.has(email)) {
      totals.duplicateEmail++;
      continue;
    }
    seen.add(email);
    recipients.push({ clerkUserId, email });
  }
  totals.eligible = recipients.length;
  return { recipients, recipientAccounts, totals };
}

export const snapshot = (content = buildSlowServiceAnnouncement()) => {
  const contentHash = digest(JSON.stringify(content));
  if (contentHash !== frozenContentHash) {
    throw new AnnouncementError(
      "Rendered announcement differs from the frozen content snapshot; review the copy before running this campaign",
    );
  }
  return { content, contentHash };
};
export type Snapshot = ReturnType<typeof snapshot>;
export const payloadFor = (content: Snapshot["content"], email: string) => ({
  ...content,
  to: [normalizeEmail(email)],
});

export function assertCatalogLive(catalog: ChallengeCatalogResponse): void {
  const challenge = catalog.challenges.find(
    (entry) => entry.slug === "make-it-fast",
  );
  const previous = catalog.challenges.find(
    (entry) => entry.slug === "broken-agent",
  );
  if (
    !challenge?.playable ||
    !challenge.open ||
    challenge.closed !== false ||
    challenge.challengeVersion !== slowServiceCampaign
  ) {
    throw new AnnouncementError(
      "Live catalog must show make-it-fast playable/open, not closed, at slow-service-v3",
    );
  }
  if (previous?.closed !== true || previous.open !== false) {
    throw new AnnouncementError(
      "Live catalog must show broken-agent closed and not open",
    );
  }
}

export function assertGuideLive(status: number, html: string): void {
  const visible = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
  if (
    status !== 200 ||
    !visible.includes("The Slow Service") ||
    !visible.includes("createLedger") ||
    !visible.includes(slowServiceCampaign) ||
    !visible.includes(slowServiceInitCommand) ||
    !/\bamend\s*\(/.test(visible) ||
    !/\breport\s*\(/.test(visible) ||
    !visible.includes("percentile") ||
    !visible.includes("debits") ||
    !visible.includes("debitAmountAtPercentile")
  ) {
    throw new AnnouncementError(
      "Live guide must return HTTP 200 with the actual Slow Service historical debit-percentile guide, version and init command",
    );
  }
}

export async function verifyLiveChallenge(
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const catalog = await fetcher("https://hacktheandes.com/api/v1/challenges", {
    headers: { "cache-control": "no-cache" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (catalog.status !== 200)
    throw new AnnouncementError("Live catalog is unavailable");
  const decoded = decode(
    ApiSuccessSchema(ChallengeCatalogSchema),
    await catalog.json(),
    "Live catalog",
  );
  assertCatalogLive(decoded.data);
  const guide = await fetcher(slowServiceGuideUrl, {
    headers: { "cache-control": "no-cache" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  assertGuideLive(guide.status, await guide.text());
}

export type AnnouncementOptions = {
  readonly mode: "preview" | "dry-run" | "send";
  readonly limit: number;
};

export function parseOptions(args: readonly string[]): AnnouncementOptions {
  let send = false;
  let confirm = false;
  let preview = false;
  let dryRun = false;
  let limit = 50;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--send") send = true;
    else if (arg === "--confirm-live-challenge") confirm = true;
    else if (arg === "--preview") preview = true;
    else if (arg === "--dry-run" || arg === "--count") dryRun = true;
    else if (arg === "--limit") {
      limit = Number(args[++index]);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new AnnouncementError("--limit must be between 1 and 100");
    } else throw new AnnouncementError("Unknown announcement option");
  }
  if (send && (!confirm || preview || dryRun))
    throw new AnnouncementError(
      "Sending requires --send --confirm-live-challenge without preview/dry-run/count",
    );
  if (confirm && !send)
    throw new AnnouncementError("--confirm-live-challenge requires --send");
  if (preview) return { mode: "preview", limit };
  if (send) return { mode: "send", limit };
  return { mode: "dry-run", limit };
}

export function deliveryAction(input: {
  status: string;
  startedAt: number;
  updatedAt: number;
  now: number;
}): "duplicate" | "busy" | "expired" | "retry" {
  if (input.status === "sent") return "duplicate";
  if (input.status !== "sending" && input.status !== "failed") return "expired";
  if (input.now - input.startedAt >= retryWindowMs) return "expired";
  if (input.status === "sending" && input.now - input.updatedAt < leaseMs)
    return "busy";
  return "retry";
}

export function decode<
  S extends Schema.Top & { readonly DecodingServices: never },
>(schema: S, value: unknown, label: string): S["Type"] {
  try {
    return Schema.decodeUnknownSync(schema)(value);
  } catch {
    throw new AnnouncementError(
      `${label} returned invalid data; refusing to continue`,
    );
  }
}
