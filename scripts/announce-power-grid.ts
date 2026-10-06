import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseEnvironment } from "./deploy-environment";
import {
  AnnouncementError,
  campaignId,
  campaignStage,
  campaignUserId,
  parseOptions,
  planRecipients,
  providerKey,
  retryWindowMs,
  snapshot,
  verifyLiveChallenge,
} from "./power-grid-announcement/campaign";
import { createDeliveryStore } from "./slow-service-announcement/delivery";
import { createProvider } from "./slow-service-announcement/provider";

const report = (value: unknown) =>
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

async function productionEnvironment() {
  const commonDirectory = execFileSync(
    "git",
    ["rev-parse", "--git-common-dir"],
    {
      cwd: import.meta.dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();
  const canonicalRoot = dirname(resolve(import.meta.dir, commonDirectory));
  let source: string;
  try {
    source = await readFile(
      resolve(canonicalRoot, ".env.production.local"),
      "utf8",
    );
  } catch {
    throw new AnnouncementError(
      "Missing .env.production.local in the canonical repository; no environment fallback is allowed",
    );
  }
  const values = { ...parseEnvironment(source), ...process.env };
  function required(name: string) {
    const value = values[name];
    if (!value)
      throw new AnnouncementError(
        `Missing required environment variable ${name}`,
      );
    return value;
  }
  const databaseUrl = required("NEW_DATABASE_URL");
  process.env.NEW_DATABASE_URL = databaseUrl;
  return {
    databaseUrl,
    clerkKey: required("CLERK_SECRET_KEY"),
    resendKey: required("RESEND_API_KEY"),
  };
}

export async function main(args: readonly string[]) {
  const options = parseOptions(args);
  const content = snapshot();
  if (options.mode === "preview") {
    const htmlPath = "/tmp/power-grid-announcement-preview.html";
    const textPath = "/tmp/power-grid-announcement-preview.txt";
    await Bun.write(htmlPath, content.content.html);
    await Bun.write(textPath, content.content.text);
    report({
      campaignId,
      campaignUserId,
      campaignStage,
      contentHash: content.contentHash,
      subject: content.content.subject,
      htmlPath,
      textPath,
      sends: 0,
    });
    return;
  }
  if (!process.execArgv.includes("--no-env-file")) {
    throw new AnnouncementError(
      "Run with bun --no-env-file; automatic development environment loading is not allowed",
    );
  }

  let live = true;
  let liveBlocker: string | undefined;
  try {
    await verifyLiveChallenge();
  } catch (error) {
    live = false;
    liveBlocker = "Live challenge verification failed";
    if (error instanceof AnnouncementError) liveBlocker = error.message;
    if (options.mode === "send") throw new AnnouncementError(liveBlocker);
  }
  const environment = await productionEnvironment();
  // db/worker reads NEW_DATABASE_URL at module initialization.
  const { db } = await import("@chofex/db/worker");
  const { participants } = await import("@chofex/db/schema");
  const store = createDeliveryStore(db, () => performance.now(), {
    id: campaignId,
    userId: campaignUserId,
    stage: campaignStage,
  });
  let ownership:
    | { kind: "readonly" }
    | Awaited<ReturnType<typeof store.acquireLease>>;
  if (options.mode === "send") ownership = await store.acquireLease();
  else ownership = { kind: "readonly" };
  if (ownership.kind === "busy")
    throw new AnnouncementError(
      "Another sender owns this campaign; no provider requests were made",
    );
  try {
    let providerRequests = 0;
    report({
      campaignId,
      phase: "checking_recipient_policy",
      mode: options.mode,
    });
    const provider = createProvider({
      ...environment,
      beforeRequest: async () => {
        providerRequests++;
        if (providerRequests % 50 === 0)
          report({
            campaignId,
            phase: "checking_recipient_policy",
            providerRequests,
          });
        if (ownership.kind === "acquired")
          await store.heartbeat(ownership.lease);
      },
    });
    const participantRows = await db
      .select({ clerkUserId: participants.clerkUserId })
      .from(participants);
    report({
      campaignId,
      phase: "reading_policy",
      participantCount: participantRows.length,
    });
    const policy = await provider.policy();
    report({
      campaignId,
      phase: "policy_loaded",
      contacts: policy.contacts.length,
      suppressions: policy.suppressions.length,
      previousEmails: policy.emails.length,
    });
    const accounts = await provider.accounts();
    const plan = planRecipients({
      participantUserIds: participantRows.map((row) => row.clerkUserId),
      accounts,
      ...policy,
    });
    const storedSnapshot = await store.readSnapshot(content);
    const progress = await store.progress(plan.recipientAccounts);
    report({
      campaignId,
      campaignUserId,
      campaignStage,
      contentHash: content.contentHash,
      mode: options.mode,
      live,
      liveBlocker,
      storedSnapshot,
      totals: plan.totals,
      progress,
      batchLimit: options.limit,
    });
    if (ownership.kind === "readonly") return;
    const lease = ownership.lease;
    await store.heartbeat(lease);
    await verifyLiveChallenge();
    await store.freezeSnapshot(content, lease);
    await store.bindAccounts(
      plan.recipientAccounts,
      content.contentHash,
      lease,
    );
    const totals = {
      sent: 0,
      duplicate: 0,
      busy: 0,
      expired: 0,
      address_changed: 0,
      staleOrSuppressed: 0,
    };
    let attempted = 0;
    for (const recipient of plan.recipients) {
      if (attempted >= options.limit) break;
      await store.heartbeat(lease);
      if (!(await provider.stillReachable(recipient))) {
        totals.staleOrSuppressed++;
        continue;
      }
      await verifyLiveChallenge();
      const claim = await store.claim(recipient, content, lease);
      if (claim.kind !== "claimed") {
        totals[claim.kind]++;
        continue;
      }
      attempted++;
      let providerId: string;
      try {
        providerId = await provider.send(
          claim.body,
          providerKey(claim.metadata.email),
          async () => {
            await store.heartbeat(lease);
            if (Date.now() - claim.metadata.startedAt >= retryWindowMs)
              throw new AnnouncementError(
                "Recipient idempotency window expired; manual provider reconciliation required",
              );
            await verifyLiveChallenge();
            if (!(await provider.stillReachable(recipient)))
              throw new AnnouncementError(
                "Recipient is no longer reachable or subscribed; stopped before send",
              );
            await store.heartbeat(lease);
          },
        );
      } catch (error) {
        await store.finish(claim.scope, claim.metadata, lease, {
          kind: "failed",
        });
        report({ campaignId, totals, attempted, stopped: true });
        throw error;
      }
      // Resend may have accepted before this database write fails. Preserve the
      // original provider key and address for recovery within its 24-hour window.
      await store.finish(claim.scope, claim.metadata, lease, {
        kind: "sent",
        providerId,
      });
      totals.sent++;
      if (totals.sent % 10 === 0)
        report({ campaignId, phase: "sending", sentInBatch: totals.sent });
    }
    report({
      campaignId,
      campaignUserId,
      campaignStage,
      totals,
      attempted,
      resume:
        "Rerun the same command. Sent accounts are skipped; changed addresses and expired uncertainties require manual reconciliation.",
    });
    if (totals.expired || totals.address_changed)
      throw new AnnouncementError(
        "Some account deliveries require manual reconciliation; they were not retargeted or resent",
      );
  } finally {
    if (ownership.kind === "acquired")
      await store.releaseLease(ownership.lease);
  }
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    let message =
      "Unexpected failure; no recipient or provider diagnostics are printed. Check configuration and resume the same campaign.";
    if (error instanceof AnnouncementError) message = error.message;
    process.stderr.write(`${JSON.stringify({ campaignId, error: message })}\n`);
    process.exitCode = 1;
  }
}
