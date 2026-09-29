# Hack the Andes

Hack the Andes is an in-person hackathon in Lima, organized by Chofex. This
repository contains the public participant site, application and review flows,
technical qualification challenges, the `/api/v1` API, and the `chofex` CLI.

- Website: [hacktheandes.com](https://hacktheandes.com)
- Challenges and rankings: [hacktheandes.com/challenges](https://hacktheandes.com/challenges)
- CLI package: [chofex-cli](https://www.npmjs.com/package/chofex-cli)

## Participant quick start

Install the CLI on macOS, Linux, or Windows under Git Bash without Node.js or
npm:

```sh
curl -fsSL https://hacktheandes.com/install | bash
export PATH="$HOME/.chofex/bin:$PATH"
chofex login
chofex whoami
chofex register
```

The installer detects Apple silicon, Intel macOS, glibc Linux, musl Linux, and
Windows on Arm or x64. It verifies the release checksum and installs `chofex` in
`~/.chofex/bin`. To pin a release, pass `--version` after `bash -s --`:

```sh
curl -fsSL https://hacktheandes.com/install | bash -s -- --version 0.1.146
```

Alternatively, the npm package supports Node.js 20 and newer:

```sh
npm install --global chofex-cli@latest
chofex login
chofex whoami
chofex register
```

The CLI authenticates through Clerk OAuth with PKCE. Access and refresh tokens
are stored in Keychain on macOS, Secret Service on Linux, or Password Vault on
Windows. Run `chofex logout` to revoke and remove stored credentials, or
`chofex update` to install the latest release through the same installation
method you originally used.

### Application flow

```sh
# Complete and submit an application interactively
chofex register

# Check the latest application and any next steps
chofex status
chofex requirements

# After acceptance, personalize the default badge and provide attendance details
chofex confirm

# Check background badge generation
chofex badge

# Change the badge name, one-liner, photo, or QR destination
chofex badge regenerate
```

Registration is for the on-site event in Lima. The application uses the
participant's primary Clerk email and asks for their name, role, optional phone
number, bio, portfolio, shipped project, LinkedIn and GitHub profiles, and
acceptance of the Terms and Conditions.

Rejected and withdrawn applications remain in history but allow a new
application. Interactive registration pre-fills the latest application's
answers; press Enter to keep an answer or Ctrl+U to clear and replace it.

Acceptance immediately creates a default badge from the Clerk name, one-line
role, and picture visible to reviewers, including the participant's best exact
challenge placement. `chofex confirm` can replace the badge name, one-liner,
and picture while collecting the separate full legal name, ID, and other required
attendance details. A phone number is optional but encouraged for WhatsApp
coordination. Custom uploads accept JPEG, PNG, or WebP files up to 5 MB:

```sh
chofex confirm --input attendance.json --picture /path/to/picture.png
```

For that non-interactive upload, set `pictureSource` to `upload` in
`attendance.json`.

The QR destination is chosen from portfolio, GitHub, then LinkedIn.
`chofex badge regenerate` remains available after confirmation to override the
public name, one-line description, QR destination, and confirmed picture
without changing the historical application.

### Technical challenges

The CLI includes scheduled qualification challenges. Run the challenge command
without a subcommand for the guided quick start. The currently implemented
Black Box challenge asks participants to reverse-engineer a personalized
shipping-price service with limited queries and evaluations.

Broken Agent starts from an AI-generated job scheduler whose public tests are
already green. Participants harden one `scheduler.js` implementation against
participant-seeded concurrency, persistence, recovery, idempotency,
compatibility, and load scenarios. The normative contract is public, AI tools
are allowed, and five official evaluations return capability-level scores
without revealing individual cases. Broken Agent uses deterministic operation
cost—not wall-clock runtime—as its final numeric tie-breaker. It is explicitly a
human–agent collaboration challenge: the participant chooses an adversarial
trace to investigate and submits a source-bound engineering review with their
evidence, release decision, confidence, and remaining risk. An agent may
implement and explain, but may not invent that judgment.

Technical challenges are mandatory for admission. An application creates a
candidacy but does not reserve a seat; organizers select the strongest engineers
from challenge rankings. Broken Agent official evaluations also require a
short-lived participant browser approval bound to the exact source and review.
The first CLI request creates that handoff without consuming an attempt; the
approved retry performs the evaluation. Challenge slugs resolve only to their
latest configured versions; legacy attempts remain historical and cannot satisfy
admission eligibility.

```sh
chofex challenge
chofex challenge list
chofex challenge init --challenge black-box
chofex challenge show --challenge black-box
chofex challenge query --challenge black-box --distance 10 --weight 3 --hour 14 --fragile false --express false
chofex challenge notebook --challenge black-box
chofex challenge test --challenge black-box --source ./shipping.js
chofex challenge evaluate --challenge black-box --source ./shipping.js
chofex challenge ranking --challenge black-box

chofex challenge init --challenge broken-agent
cd broken-agent && npm test
chofex challenge test --challenge broken-agent --source ./scheduler.js
chofex challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json
chofex challenge ranking --challenge broken-agent
```

`list` and `ranking` are public. The other networked challenge commands require
sign-in. For Black Box, `test` checks only saved notebook observations. For
Broken Agent, it runs the seven visible behavioral tests. Both are repeatable and
do not consume an official evaluation; `query` and `evaluate` use limited
attempt budgets. Broken Agent evaluation also requires the participant-authored
`review.json`; its `sourceDigest` must match the exact submitted source.

### Agent and script usage

Generate complete templates, validate them locally, and request JSON output for
automation:

```sh
chofex schema --stage application > application-template.json
chofex --output json validate --stage application --input application.json
chofex --output json register --input application.json
chofex --output json status

chofex schema --stage acceptance > attendance-template.json
chofex --output json validate --stage acceptance --input attendance.json
chofex --output json confirm --input attendance.json
```

Use `--input -` to read JSON from stdin. In JSON mode, stdout contains exactly
one versioned result envelope; prompts and diagnostics use the terminal or
stderr, and the welcome screen is omitted. Automation can provide an OAuth
access token through `CHOFEX_TOKEN` without storing it.

## Agent skill

Install the Hack the Andes application skill in a supported coding agent with
[skills.sh](https://skills.sh):

```sh
npx skills add https://github.com/crafter-station/hack-the-andes --skill chofex-hackathon -g -y
```

The skill guides an agent through application and post-acceptance flows while
keeping authentication, personal answers, consent, and final submission
approval with the participant. Its source is
[`skills/chofex-hackathon/SKILL.md`](skills/chofex-hackathon/SKILL.md).

## Local development

The monorepo uses Bun 1.3.14, Turbo, and Node.js 24 or newer. PostgreSQL is
required for the web application.

```sh
bun install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
# Fill in at least the database and Clerk values before continuing.
bun --env-file=apps/web/.env.local --filter @chofex/db db:migrate
bun dev
```

Turbo starts the participant site and API at
[localhost:3000](http://localhost:3000).

Run the CLI directly from source with arguments after `--`:

```sh
bun run --filter chofex-cli dev -- status
```

The source CLI defaults to the production API. Set `CHOFEX_API_URL` and
`CHOFEX_PUBLIC_SITE_URL` to `http://localhost:3000` when exercising local web
flows. `CHOFEX_OAUTH_ISSUER` and `CHOFEX_OAUTH_CLIENT_ID` override its default
OAuth configuration; point them at the same Clerk instance and OAuth client as
the local web app.

### Service configuration

Start from [`apps/web/.env.example`](apps/web/.env.example). The main feature
groups are:

- **Core:** `NEW_DATABASE_URL`, Clerk publishable and secret keys,
  `CLERK_CLI_OAUTH_CLIENT_ID`, `CLERK_OAUTH_ISSUER`, and
  `CLERK_AUTHORIZED_PARTIES`. Funnel reminders additionally require a Clerk
  `session.created` webhook pointing to `/api/webhooks/clerk` and its
  `CLERK_WEBHOOK_SIGNING_SECRET`.
- **Attendance:** `PARTICIPANT_DATA_ENCRYPTION_KEY` encrypts national ID or
  passport numbers with AES-256-GCM. A public Vercel Blob store and
  `BLOB_READ_WRITE_TOKEN` enable custom profile pictures.
- **Challenges:** `CHALLENGE_SEED_SECRET` protects participant-specific seeds.
  `CHALLENGE_ENGINE_URL` and `CHALLENGE_ENGINE_API_SECRET` connect the public
  application to the separately deployed private challenge engine.
  `CHALLENGES_FORCE_OPEN=true` opens implemented challenges early in preview
  environments.
- **Operations:** reviewers normally receive the `application_reviewer` role
  in Clerk private metadata; `ADMIN_CLERK_USER_IDS` is an optional break-glass
  list. PostHog is disabled when `NEXT_PUBLIC_POSTHOG_KEY` is unset.

Badge generation and two-hour funnel reminders run in Trigger.dev and are not
started by `bun dev`. Set `TRIGGER_SECRET_KEY` in the web environment, then set
`NEW_DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `AI_GATEWAY_API_KEY`, and
`RESEND_API_KEY` in the matching Trigger.dev environment. Run tasks locally or
deploy them with:

```sh
bun --filter @chofex/web trigger:dev
bun --filter @chofex/web trigger:deploy
```

For production infrastructure, see [`deploy/README.md`](deploy/README.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js participant site, admin UI, API, and Trigger.dev task host |
| `apps/cli` | Published `chofex` executable built with Effect |
| `packages/registration-contract` | Shared registration schemas and API envelopes |
| `packages/challenges-contract` | Shared challenge catalog, schemas, and scoring types |
| `packages/db` | Drizzle schema, migrations, and database clients |
| `packages/ui` | Shared UI components and brand primitives |
| `skills/chofex-hackathon` | Agent-facing application workflow |

## API

Participant endpoints accept Clerk browser session tokens or OAuth tokens issued
to the Chofex CLI. Responses use a versioned
`{ version, ok, requestId, data | error }` envelope. Authentication failures
advertise OAuth discovery through `/.well-known/oauth-protected-resource`.

### Registration

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/me` | Verify the current Clerk identity |
| `POST` | `/api/v1/registrations` | Create and submit a complete application |
| `GET` | `/api/v1/registration` | Read the latest application and requirements |
| `PUT` | `/api/v1/registration` | Create or update an application draft |
| `POST` | `/api/v1/registration/submit` | Submit a complete draft for review |
| `PUT` | `/api/v1/registration/attendance` | Complete post-acceptance details |
| `POST` | `/api/v1/profile-picture` | Authorize one accepted-participant Blob upload |
| `PUT` | `/api/v1/profile-picture` | Verify and record a completed Blob upload |
| `GET` | `/api/v1/badge` | Read badge generation status and URL |

Picture uploads are restricted to accepted participants, scoped to one random
Blob pathname, verified after upload, and limited to five attempts per 24-hour
window.

### Challenges

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/challenges` | List the public challenge catalog |
| `GET` | `/api/v1/challenges/:slug` | Read an authenticated participant's attempt |
| `POST` | `/api/v1/challenges/:slug/query` | Query the challenge oracle |
| `POST` | `/api/v1/challenges/:slug/test` | Test a solution against saved observations |
| `POST` | `/api/v1/challenges/:slug/evaluate` | Run one official hidden-set evaluation |
| `GET` | `/api/v1/challenges/:slug/ranking` | Read the public ranking when visible |

## Verification

```sh
bun test
bun run lint
bun run check-types
NEW_DATABASE_URL=postgresql://user:pass@localhost:5432/db bun run build
```

## License

[MIT](LICENSE)
