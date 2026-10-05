# Production deployment

The public website and private challenge engine run as separate Dokploy projects on `vps.cueva.io`. GitHub Actions builds SHA-addressable GHCR images from each repository; Dokploy pulls those images and serves them through Let's Encrypt domains.

The public application uses `hacktheandes.com`; the private challenge API uses `engine.hacktheandes.com`.

## Local secrets

The deploy script reads `.env.production.local`, then applies process-environment overrides. It deliberately does not fall back to development env files. Keep this file untracked and complete; a missing required value stops the plan before Dokploy is changed. Dokploy authentication defaults to `~/.vps/config.json`; set `domain` to `https://vps.cueva.io` and use an API key generated from Dokploy's Profile page.

The script obtains the GHCR username and token from `GHCR_USERNAME` / `GHCR_TOKEN` when provided, otherwise from the authenticated GitHub CLI. The token must be able to pull the private `chofex-challenges-private` package.

## Commands

```sh
bun run deploy:plan
bun run deploy:apply -- --confirm-production
bun run deploy:status
```

`deploy:plan` and `deploy:status` are read-only. `deploy:apply` idempotently creates or reconciles both projects, applications, runtime variables, domains, and TLS settings, then deploys both immutable commit-tagged images. It never prints secret values. Main-branch image releases also reconcile manifest-derived service variables before redeploying, while preserving every other runtime variable already stored in Dokploy.

Runtime URLs between applications, such as `CHALLENGE_ENGINE_URL`, are derived from the target application's domain in `deploy/dokploy.json`; do not duplicate them in `.env.production.local`.

On the first release, push both repositories and wait for their image workflows before applying. The initial workflows publish images but skip Dokploy because application IDs do not exist yet. The apply command installs each new application ID and the API key into that repository's `Production` GitHub environment; later main-branch builds update Dokploy to the exact image tag they just published.

Database migrations remain explicit:

```sh
bun --env-file=.env.production.local --filter @chofex/db db:migrate
```

DNS is a separate cutover. Point `hacktheandes.com` and `engine.hacktheandes.com` at the IP reported by `deploy:plan` after both images are available and the Dokploy applications have been created. A first `deploy:apply` creates HTTP routes without requesting certificates; after DNS resolves to the VPS, a second apply enables Let's Encrypt.

## Participant name migration

Migration `0026_fuzzy_rage.sql` moves the latest nonblank legal name from acceptance details to `participants.legal_name`. Coordinate the migration with the web deployment because the previous web version uses the removed `acceptance_details.full_name` column. Pause attendance edits and drain the previous web version before the cutover.

Deploy the Trigger tasks with `bun --filter @chofex/web trigger:deploy` and configure `NEW_DATABASE_URL` and `CLERK_SECRET_KEY` in that Trigger environment. The `reconcile-participant-names` task runs every minute. It sends saved public names to Clerk, retries failures after five minutes, and checks synchronized names hourly for drift. Each run processes up to 100 participants. The web request saves names without waiting for Clerk or Trigger.

After deployment, confirm that the schedule is active in Trigger and that a public-name edit appears in Clerk. The participant's legal name must remain unchanged after a badge-name edit.

## Challenge 4 admin early access

Power Grid is available through the ordinary CLI endpoints before public launch
when the authenticated Clerk user's public or private metadata contains
`role: "admin"`, `role: "application_reviewer"`, or the corresponding
`roles` array. OAuth and browser tokens authenticate
normally; the server fetches current Clerk metadata on each operation.
These are the same metadata roles used by the admin panel. Configured admin IDs
alone do not grant early access.
No shared secret or special preview endpoint is required.

Admins use their regular participant attempt, notebook, query reservations,
evaluations and scores. The limits are 25 successful queries and 3 official
evaluations; closing the CLI or reloading a browser does not reset them. Tests
against the notebook are free. Public participation remains disabled by
`playable: false` until an explicit launch change. Authenticated admin catalog
and attempt responses advertise Power Grid as playable and open.

Use a CLI build from this branch; the current npm version does not yet include
Power Grid. From a checkout with Bun 1.3.14 installed:

```sh
bun install --frozen-lockfile
bun --filter chofex-cli build
npm install --global ./apps/cli --ignore-scripts
andes login
andes challenge list
andes challenge init --challenge power-grid
cd power-grid
andes challenge query --challenge power-grid --input input.json
andes challenge notebook --challenge power-grid
andes challenge test --challenge power-grid --source bill.js
andes challenge evaluate --challenge power-grid --source bill.js
andes challenge show --challenge power-grid
```

For an authorized branch deployment, dispatch `production-image.yml` with
`deploy=true`. The private engine already supports `power-grid-v1`. The web
workflow removes the former shared preview secret from Dokploy while preserving
other variables and build settings. Delete the former GitHub Production secret
as well. npm publication continues to use the exact-commit release approval.
