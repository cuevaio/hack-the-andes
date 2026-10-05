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

## Challenge 4 admin preview

The private electricity billing preview is at `/admin/challenges/power-grid`.
An existing account with access to the admin panel and the shared
`POWER_GRID_ADMIN_PREVIEW_SECRET` are both required. The key is entered in the
browser, sent in a request header, and kept only in the current tab. It must not
be placed in a URL or a `NEXT_PUBLIC_*` variable.

The preview calls the private `power-grid-v1` oracle and grader with separate,
deterministic admin seeds. It does not create participant attempts, observations,
evaluations, funnel milestones, or rankings. The browser simulates 25 queries
and 3 evaluations. Reloading starts a fresh local notebook with the same rules.
Admins can download their notebook and `bill.js` before reloading. Public Power
Grid participation stays disabled by `playable: false`, including after its
placeholder opening date, until a later explicit launch change.

For a requested preview deployment, dispatch `production-image.yml` from the
reviewed branch with the boolean input `deploy=true` in both repositories. The
workflow builds and deploys the immutable commit image without merging to main
or triggering an npm release. The web workflow requires the preview key in its
GitHub `Production` environment and writes that key to the existing Dokploy
application while preserving other runtime variables and build settings. Do not
replace the application environment with a partial set of variables.

To test: sign in, open the preview page, enter the shared key, change a field in
the reading JSON, and select `Consultar`. Edit `calculateBill(input)` in the code
box, use `Probar cuaderno` for free notebook checks, and select `Evaluar solución`
for the hidden score over 1,000 cases. Admin panel access follows the existing
configured admin IDs and Clerk admin/application-reviewer roles.
