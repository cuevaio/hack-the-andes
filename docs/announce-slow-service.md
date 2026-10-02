# Announce The Slow Service

Run this campaign only after the accounting service with exact historical debit percentiles in challenge 3 passes the release gates and is live at `slow-service-v3`. Sending also requires separate, explicit post-launch authorization from the parent. It sends the same Spanish announcement to all registered participants with a current, verified primary Clerk email. Application status does not affect eligibility. Neither the earlier merchant/customer statistics problem nor the v2 journal is this campaign's target.

The v3 contract keeps the journal amendment input unchanged. Reports add an integer `percentile` from 1 through 100 and return `debits` and `debitAmountAtPercentile` alongside the five accounting fields. The amount is the exact nearest rank of negative-leg magnitudes, with multiplicity, for the selected account, interval and historical checkpoint. Credits are excluded; an empty debit distribution returns `null`. No party labels or distinct-counterparty API are announced.

Use Bun 1.3.14 from the repository root. Keep Bun's automatic environment loading disabled. The script reads `.env.production.local` from the canonical checkout identified by Git's common directory, not from the announcement worktree. On Grotte, that file is `/home/cueva/projects/hack-the-andes/.env.production.local`. Process overrides are allowed. Never copy this file into a worktree.

## Preview and count

Preview needs no credentials and makes no network requests:

```sh
bun --no-env-file scripts/announce-slow-service.ts --preview
```

Read the HTML and plain-text paths reported by the command. The preview includes the campaign content hash but no recipient data.

The final v3 content fingerprint is `137e13d2e53facf8f450b339508142eb9db1a9996459da5221bff7413eac1ca3`. The script refuses a changed subject, copy, sender, header, or rendered template before loading production configuration. This also prevents silent content changes before the first database snapshot is frozen.

The agent may implement and test. The participant reviews a concrete failure case and real evidence, then approves the source-bound review in the browser. Approval records responsibility, not unassisted work or verified understanding. The email uses the shipped `chofex challenge init --challenge make-it-fast` command. Evaluation arguments remain in the live guide.

Count eligible recipients and existing deliveries without writing to the database or Resend:

```sh
bun --no-env-file scripts/announce-slow-service.ts --dry-run
```

No flags, `--count`, and `--dry-run` all use this read-only mode. The report shows aggregate eligibility and delivery counts, the content hash, and any live-check blocker. It never prints participant names, email addresses, IDs, provider response bodies, or secrets.

The canonical production file must contain these variables:

- `NEW_DATABASE_URL`
- `CLERK_SECRET_KEY`
- `RESEND_API_KEY`

The Resend key needs permission to read contacts, suppressions, and sent-email events as well as send email. A sending-only key stops the campaign rather than treating unavailable suppression data as an empty list.

## Send and resume

After reviewing the preview and counts, run:

```sh
bun --no-env-file scripts/announce-slow-service.ts --send --confirm-live-challenge --limit 50
```

Each invocation sends at most 50 new or retryable deliveries. `--limit` accepts 1 through 100. Rerun the identical command until the dry-run report has no pending or retryable eligible deliveries. The script skips completed accounts and records provider IDs in the database. It stops on a provider failure, so use a dry run before resuming.

Only one sender can own the campaign. A competing `--send` stops before contacting Clerk or Resend. Dry runs do not acquire or refresh this lease. The sender checks and renews its fenced ownership token before each participant and every provider HTTP attempt, including pagination and retries. Ownership expires after two minutes without a heartbeat. An expired process cannot renew its old lease or change delivery state after another owner takes over. A heartbeat acknowledgement taking a minute or longer is rejected rather than used as fresh evidence before a provider request.

Both send flags are mandatory. The live guard reads only the canonical public host. It requires:

- `/api/v1/challenges` reports `make-it-fast` as playable, open, not closed, and at `slow-service-v3`. Versions v1 and v2 do not qualify.
- The same catalog reports `broken-agent` as closed and not open.
- The exact UTM-tagged guide link returns HTTP 200 without a redirect and contains the visible journal guide, version, `createLedger`, `amend`, `report`, `percentile`, `debits`, `debitAmountAtPercentile`, and init command. A placeholder, an older contract, or markers hidden in a script do not qualify.

The live guard runs before acquiring ownership and again before freezing content or making a send attempt. Current Clerk verification, account availability, unsubscribe state, and suppression state are checked again before each send. API errors fail closed. The provider client spaces requests by at least 700 ms, retries transport errors, HTTP 429, and server errors up to five times, and honors bounded `Retry-After` delays. Full sent-email policy pagination can take several minutes.

## Keep delivery records

This campaign reuses `funnel_email_deliveries`; no schema migration is needed. The table's campaign and status fields are strings, and `clerk_user_id` has no foreign key. Announcement rows use the reserved `campaign:slow-service-v3` namespace and stage `challenge_announcement`. Reminder rows retain their existing semantics.

The announcement scopes are:

- `snapshot`, with status `snapshot`, stores fixed content, not a sent delivery.
- `campaign_lease`, with status `locked` or `idle`, stores the current owner token. Lease expiry uses the database clock.
- `account/<Clerk-user-ID-sha256>`, with status `reserved`, permanently binds an account to its chosen normalized email and email delivery scope.
- `recipient/<normalized-email-sha256>` stores the actual sending, sent, or failed provider delivery.

The snapshot row stores the complete fixed subject, sender, reply inbox, text, HTML, headers, and content hash in `trigger_run_id`. Recipient rows store their content hash, exact provider payload hash, canonical address, originating account ID, first attempt time, delivery lease token, and successful provider ID in that text field. The stable provider key is `challenge-launch/slow-service-v3/<normalized-email-sha256>`.

Before sending the first batch, the script reserves every eligible account's selected address, including all accounts sharing an email. These reservations do not start a provider retry window. A claim creates an account reservation and its email delivery atomically in one PostgreSQL statement if they do not already exist. Account choices never change; unique email scopes still deduplicate shared mailboxes. All campaign writes lock and check the owner row within the same database statement. Failed account or email inserts cannot leave a half-created target.

A later primary-email change cannot create a second delivery or reset the original attempt's idempotency window. Completed accounts remain completed at their original address. An incomplete account with a changed address is reported as `addressChanged` and is not retargeted. A shared-address alias also keeps its original campaign choice. Snapshot and owner rows are excluded from sent-delivery counts, even if an older snapshot marker has status `sent`.

Do not delete these records, rename the campaign, change its copy after sending starts, retarget an account reservation, or clear failed deliveries to retry them. Those operations can send duplicates. Content drift is refused, account and address claims are atomic, and stale campaign owners or delivery receipts cannot overwrite a newer claim.

Resend retains idempotency keys for 24 hours. The script permits retries only within 23 hours of the first persisted attempt. An uncertain delivery older than that requires manual reconciliation against Resend and is never automatically resent. Record a confirmed provider acceptance as sent after reviewing its stored payload hash and provider ID. If acceptance cannot be established, keep the delivery blocked rather than guessing.

## Honor opt-outs and protect recipients

Each API call addresses exactly one participant. The shared organizer CC is deliberately omitted. HTML and text are not personalized, and no recipient list is included in the message.

Current Resend global contact unsubscribes and all team suppressions, including bounces, complaints, and manual suppressions, are excluded. Paginated sent-email history also excludes addresses with bounced, complained, or suppressed events, including bounces without a current suppression record. This repository has no app-managed marketing topic or HTTP one-click unsubscribe endpoint. The message therefore offers an opt-out through the existing reply inbox and a `mailto` List-Unsubscribe header. Monitor that inbox and add opt-out requests to Resend's suppression list before the next batch or future announcement. Do not claim this is an automated HTTP one-click unsubscribe flow. If the campaign is treated as bulk marketing that requires RFC 8058, establish that unsubscribe mechanism before sending.

## Verify changes locally

```sh
bun --no-env-file test scripts/slow-service-announcement
bunx --no-install tsc -p scripts/slow-service-announcement/tsconfig.json
bunx --no-install @biomejs/biome check scripts/announce-slow-service.ts scripts/slow-service-announcement apps/web/lib/emails/slow-service-announcement.ts
```

The delivery tests use a real local PGlite database. They cover concurrent account/address claims, shared-address aliases, transaction rollback, owner expiry and takeover, expired uncertain sends, and marker-free delivery counts. Provider tests use injected HTTP responses and never contact Resend or mutate production.
