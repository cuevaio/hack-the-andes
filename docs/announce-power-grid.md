# Power Grid invitation

The user authorized sending this announcement to all Hack the Andes participants
and opening challenge 4 publicly before delivery. Application status does not
filter the audience. Only verified, reachable primary Clerk email addresses
qualify. Unsubscribes, suppressions, bounce/complaint history and duplicate
addresses are excluded using the existing announcement policy.

The sender is hi@cueva.io, with replies and opt-out requests going to that same
inbox. Each message addresses one recipient, with no shared organizer CC.

Preview:

```sh
bun --no-env-file scripts/announce-power-grid.ts --preview
```

Read-only audience and delivery report:

```sh
bun --no-env-file scripts/announce-power-grid.ts --dry-run
```

Send after the public Power Grid v1 catalog and guide pass live checks:

```sh
bun --no-env-file scripts/announce-power-grid.ts --send --confirm-live-challenge --limit 100
```

Repeat the identical command until the report has no pending or retryable
recipients. Never change the campaign identity or content after sending begins.
The reviewed content fingerprint is
f680ac2b701c99d4a21f257c14f115fb64ce168c8a7b1d73affb55c35e0b4381.

This campaign uses the existing fenced delivery store with a separate identity:
`campaign:power-grid-v1-launch-announcement`. It does not overwrite the earlier
Slow Service announcement receipts. The provider idempotency prefix is
`challenge-launch/power-grid-v1-launch-announcement/`. Resume and uncertainty
handling follow docs/announce-slow-service.md. No database migration is required.

Credentials are read from the canonical checkout's .env.production.local,
with no development environment fallback. Do not copy or print that file.
Aggregate progress logs contain no email addresses or participant identities.

Validate with:

```sh
bun --no-env-file test scripts/slow-service-announcement scripts/power-grid-announcement
bunx --bun tsc --noEmit -p scripts/power-grid-announcement/tsconfig.json
```
