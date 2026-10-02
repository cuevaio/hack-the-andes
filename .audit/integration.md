# Slow Service v3 integration

## Current release authorization

The user now explicitly authorizes shipping v3 as a human-agent companion
workflow and waives the real-person pilot. The earlier closed-draft hold below
is historical and does not describe the new decision. Implement source-bound
participant engineering review and browser/passkey approval before official
evaluation. AI help remains allowed, and a correct efficient source can earn 100.
This is consent and shared responsibility, not a technical authorship detector or
validated understanding test. Keep published versions and Scheduler closure
unchanged. Deploy and announce only after actual release verification.

## Current companion verification

The public catalog enables `slow-service-v3`, and the public performance metadata
is `calibrated`. The CLI requires the source-bound companion review. The browser
shows the exact owned source and review, then uses the existing passkey ceremony.
Missing, stale, and blocked reviews do not call the engine or consume attempts.
Approvals are single-use under competing consumers. Foreign owners, wrong scopes,
unauthenticated requests, and CLI OAuth tokens cannot approve an evaluation.

The current public verification and source manifest are recorded in
`.audit/slow-service-companion-verification.md`. The remainder of this document
preserves the earlier closed-draft investigation and its historical results.

## Historical closed and uncommitted investigation

Current version is `slow-service-v3`, slug `make-it-fast`, title `The Slow Service`.
The catalog remains `playable: false`. This is preparation for the selected exact
historical debit-percentile design, not an approved release. The parent selected
candidate B alone in `.audit/third-design-synthesis.md`.

The user has now revised the assessment target. A participant may earn 100;
generic "solve this" delegation should not be sufficient, and more token budget
should not determine the winner. The parent is comparing task formats and
participation experiments in `.audit/fourth-format-brief.md`. The earlier blanket
no-perfect-first-source rule is historical, not the new acceptance rule. This
does not authorize opening v3: its generic-delegation trials already demonstrate
the unwanted outcome. Keep the catalog closed and campaign unsent while the new
format is investigated. No fourth business contract is selected yet.

The parent has also screened three alternative formats. A bounded incident toy
admits universal fixes, mandatory human review has unapproved staffing cost, and
a real SQLite service repair gave two fresh autonomous Codex sessions 100 under
its frozen grader. An independent missing delivery-limit case is recorded
separately, not used to manufacture a steering advantage. These private local
experiments are not public artifacts or a new playable challenge. Common official
agent allocation and score-only future standing are proposals, not deployed
rules. Do not change existing ranking or eligibility semantics on this basis.

The parent reports that v2's actual R2 difficulty gate failed. All four fresh
first submissions scored 100 on both seed sets, were correct and faster than
the reference. The parent records those results in
`.audit/first-submission-grades-r2-a.jsonl` and
`.audit/first-submission-grades-r2-b.jsonl`, and the representation census in
`.audit/premise-check.md`. This task did not open those private trial artifacts.
The earlier 722-test and standalone v2 verification remains a valid historical
integration result, not a successful difficulty gate. Its full record is
`.audit/slow-service-v2-integration.md`.

No commit, branch change, merge, main push, deployment, live update, production
migration or email is authorized during this investigation. Do not tighten clocks
to conceal correct efficient solutions.

The complete fresh v3 gate is blocked. The parent reports frozen OpenCode, Codex
and Claude first submissions scoring 100 on both seed sets, and Cursor scoring
72 on both. No private feedback was supplied to solvers.
These results supersede preparation readiness: keep the catalog closed and the
reviewed announcement campaign unsent. The parent records source-bound evidence
in `.audit/difficulty-gate-r3.json` and
`.audit/agent-difficulty-census-r3.json` in the private worktree.

## Current contract and examples

The copied types come only from the approved
`src/slow-service-v3/contract.ts`. They have identical tokens to the parent file,
with repository formatting. `createLedger({ accounts })` still returns exactly
the synchronous methods `amend` and `report`. Amendment inputs and outcomes,
revision/tombstone handling, atomic replacements, chronological solvency,
setup-order diagnostics and immutable checkpoints remain unchanged. No party
labels or distinct-counterparty API were added.

`report({ account, from, to, asOf, percentile })` requires integer `percentile`
from 1 to 100. It returns the five accounting fields plus `debits` and
`debitAmountAtPercentile`. Select rank `ceil(debits * percentile / 100)` over
negative-leg magnitudes for that account, half-open interval and accepted
checkpoint, counting multiplicity. Credits are excluded. Equal timestamps are
combined for accounting solvency, but do not combine debit observations.
With no debits, return 0 and null. Rejected amendments change neither balance
nor debit-distribution history.

All six existing public scenarios remain, with their old accounting expectations
and operations preserved. Their 25 report requests now use percentile 50 and
their literal outputs include the two reviewed debit fields. Two additional
public scenarios cover the 50th percentile of [100, 300] returning 100 rather
than 200, the 100th percentile returning the maximum, credits-only/empty ranges,
equal amounts/timestamps, rank boundaries, moved/replaced/reversed/voided entries,
old checkpoints and unchanged distribution after insolvency or conflict.
No private scenario, oracle, reference or trial source was imported.

The public adapter compares all seven report fields. Tests independently mutate
each field and assert the resulting failed scenario. The approved public starter
matches all eight scenarios and 87 operations in the exported participant
QuickJS runner and in the compiled standalone runner. The earlier host
`node:vm` comparison remains a separate check, not the sandbox proof.

## Provisional bounds and toolkit boundary

Current provisional bounds are 24,000 active journals and 72,000 accepted old/new
leg edits. Phase sizes are 6,000 and 24,000 journals with 1,024 measured operations.
Guest heap is 640 MiB. Source remains 32,768 UTF-8 bytes, stack 512 KiB, CPU ceiling
25 seconds and wall limit 30 seconds. Node host old-space remains parent-owned
at 512 MiB. Account, opaque UTF-16 ID, timestamp, opening and leg bounds are
unchanged. Six exact correctness groups award 60 points. Efficiency also requires
exact completion at maximum history: 24,000 journals or eight-leg entries with
63,000 accepted debit edits. Both capacity cases reach 72,000 accepted leg edits
and may configure 1,024 accounts with 64-unit UTF-16 IDs. Capacity adds no
correctness groups or points. The same 640 MiB guest heap, 25-second CPU and
30-second wall limits apply to the whole execution. Wrong output, time or memory
failure retains earned correctness points but disables all 40 efficiency points.
The four measured families remain 6,000/24,000 journals with 1,024 operations.
Tier pairs remain normalized growth / relative CPU of
1.8/3, 3.5/6 and 6/12 for 10/6/3 points, otherwise zero. Any wrong performance
output or candidate execution failure disables all 40 efficiency points.

`slowServicePublicPerformance.kind` is explicitly `provisional`. The CLI, Spanish
guide and skill reference distinguish an integrated local toolkit from release
approval. All six public sources are approved and integrated. The parent then
approved a README-only capacity-gate amendment, and the six-file export was
resynchronized. Guides match the revised capacity gate and benchmark commands.
The parent must calibrate the complete service before freezing trial materials.

The benchmark defaults to base 6000 and accepts integers from 1 to 6000. The
approved full commands are `bun run benchmark ledger.js 6000`, the same command
with `--max-history`, and with `--max-history --negative-heavy`. The standard
pair uses 6,000/24,000 journals and 1,024 later operations. Both max-history
variants reach 72,000 accepted leg edits. Negative-heavy requires both flags and
base 6000, then uses 2,000/8,000 journals with eight legs, seven negative and one
positive, reaching 63,000 accepted debit edits. Those smaller sizes diagnose
memory locally and do not replace the 6,000/24,000 graded phases. Amounts span
broad domains and reports vary percentiles. Output includes `negativeHeavy`,
`acceptedLegEdits`, `acceptedDebitEdits`, exact-output checks, phase CPU and
trusted peakRssMiB. Only the reduced 20/80 benchmark ran here. No full-capacity
reference, maximum-history memory or official efficiency success is claimed.

`toolkit.generated.ts` is now `ready` at v3 and exposes the six exact approved
files plus locally generated `package.json` and `AGENTS.md`. `runner.ts` exports
the approved public runner with only its contract import adapted and repository
formatting. The old
public v2 runner, contract and toolkit were preserved at
`/tmp/opencode/slow-service-v2-public-integration-original` before replacement.
The previously exported public v2 package and historical verification logs also
remain untouched. No v2 artifact is served under v3.

The sync script accepts only a source directory named for the current immutable
version and retains the six-file participant-safe whitelist. It ran only after
explicit approval, and again after approval of the revised README. The real CLI
still refuses init because `playable: false`. The CLI scaffold function succeeds
in an isolated preview fixture and exports all eight files exactly. The previous
pending-build refusal remains historical, not the current execution result.

`scripts/verify-slow-service-source-exposure.ts` reads only these six parent
paths, checks exact exported bytes and checks formatted integration mirrors.
The exporter reads no private reference, oracle, scenarios, evaluator, admission
helper or frozen trial source. Its generated package pins QuickJS 0.32.0.
Manifest: `/tmp/opencode/slow-service-v3-approved-source-manifest.json`.

| Approved parent source | SHA-256 |
| --- | --- |
| `README.participant.md` | `946db49c07a52b56ff311ecf69ebf6e5363b25d95ee01f3042b9c29b088fee50` |
| `starter.js` | `d94d041dcc503503c1516ee99e8694988d92807bfa0aa6b772c57f01a2cf0739` |
| `contract.ts` | `a3b787e9bc829f2aea2b089b99f3036b39708162bd028cc1c718690d6d096d26` |
| `runner.ts` | `9455750442f21f57178c56c671abff6a679a0f703a96bba13ccac4c085182f70` |
| `public-benchmark.ts` | `f972a586c55fbc83aedf03422adb17eeae2ea7dcd1c7e944f90dd3ff466fd014` |
| `participant-tests.ts` | `b1d80009cc6edd3c91e9e7b4f4967907606d7f2f464e1a89441c477f908c1aaf` |

## Stable service and ownership

Official submissions keep the version-1 evaluation envelope and select v3 from
the shared version constant. Five official attempts, source SHA persistence,
reservations, standard score fields, trusted challengeSlug marker, ranking,
eligibility and badge behavior are unchanged. Initialization rejection and
infrastructure 503 responses release reservations without consuming an attempt.
The protocol fixture explicitly covers occupied engine admission and preserves
synthetic v1 and v2 results while excluding both from v3 ranking and eligibility.
Its official scores are localhost stubs, not private-grader proof.

Private single-child admission, release only after child exit, cached-baseline
ownership under abandoned deadlines, 300-second grading deadlines, reference
layouts and capacity checks belong to the parent. No public roots, storage or
locks were added. Existing request budgets remain engine 330 seconds, route/CLI
360 seconds and reservation 390 seconds pending end-to-end/proxy verification.
Trusted production access and actual capacity remain unverified; do not bypass
SSH host-key verification or infer launch readiness from kernel samples.

The parent replaced the 12 announcement files with its reviewed v3 bundle.
This task did not edit, replace or run their campaign. Read-only archive
comparison confirms all 12 files match
`/tmp/opencode/slow-service-v3-announcement-bundle.tar.gz`, SHA-256
`ef80bef0e68812545e478bb33120d90475ea9b12bc4aba89026ac1b273f2032d`.
Later approved bundles remain owner-managed.
Scheduler closure files still match `ef8751f`. HEAD remains the old `a3bdd954`
base; the parent owns the eventual feature commit and origin/main merge.
Migration `0028` is a future release requirement, not authorization to apply it.

## Verification and remaining gates

- `NEW_DATABASE_URL=postgresql://test:test@127.0.0.1:5432/test bun test` passes
  726 tests, skips zero and fails zero, with 8,937 assertions across 123 files.
  Log: `/tmp/opencode/slow-service-v3-approved-tests.log`. The obsolete pending
  readiness test was removed when the runner became available.
- Root typecheck and lint pass. Logs:
  `/tmp/opencode/slow-service-v3-approved-{types,lint}.log`. All five TypeScript
  public verification/export scripts pass an explicit strict TypeScript check.
  Those scripts and the compiled-build probe pass Biome checks. Logs:
  `/tmp/opencode/slow-service-v3-approved-scripts-{types,lint}.log`.
- `NEW_DATABASE_URL=postgresql://test:test@127.0.0.1:5432/test bun run build`
  passes the root CLI and standalone Next build. Font fallback and filesystem
  tracing warnings remain visible, with no build failure. Log:
  `/tmp/opencode/slow-service-v3-approved-build.log`.
- `bun scripts/prepare-slow-service-v3-fixtures.ts --verify` checks all six
  preserved scenarios and their 25 reviewed literal debit fields. This rerunnable
  public-only migration/check tool never reads private fixtures.
- `node scripts/verify-slow-service-public-examples.ts
  /home/cueva/projects/chofex-challenges-difficulty/src/slow-service-v3/starter.js`
   reads only the approved public starter and verifies every literal response:
   eight scenarios, 87 operations, exact results. Runtime is trusted host
   `node:vm`, not QuickJS. The helper is not a candidate
  sandbox. Log: `/tmp/opencode/slow-service-v3-literal-starter-proof.log`.
- `bun scripts/verify-slow-service-source-exposure.ts
  /home/cueva/projects/chofex-challenges-difficulty/src/slow-service-v3` confirms
  exact six-file source exposure, the two generated extras, formatted mirrors,
  current version and `playable: false`. No parent directory enumeration occurs.
- `bun scripts/verify-slow-service-toolkit.ts` verifies the real closed CLI init
  refusal, then runs the CLI scaffold function in an isolated in-process preview
  fixture. Its eight exported files match exactly, install succeeds, and all six
  participant tests pass. The exported QuickJS runner matches all 87 operations.
  Reduced 20/80 benchmark output is exact with trusted peak RSS of about
  79.44/79.97 MiB. These are local diagnostics, not official performance scores.
  Export: `/tmp/opencode/slow-service-v3-toolkit-proof-2a7j14/slow-service`.
  Log: `/tmp/opencode/slow-service-v3-approved-toolkit.log`.
- `node scripts/verify-slow-service-build.mjs` executes the compiled declarations
  unchanged with native imports and QuickJS resolved inside the standalone tree.
  All eight scenarios pass. Execution, budget, timeout and memory probes fail
  with the expected reasons. Valid-shaped wrong zero output completes, invalid
  percentile output is rejected, and recovery plus a minimal public health
  report pass. All 16 owned children close before their awaited result returns.
  This uses only approved public artifacts, not parent-private health code.
  Log: `/tmp/opencode/slow-service-v3-approved-compiled.log`.
- Browser verification uses the actual standalone build on `127.0.0.1:3218`.
  A process-only fetch fixture supplies empty read-only SELECT responses and
  rejects external server fetches. No production database or credentials are
  used. The guide shows the closed state, seven-field contract, capacity gate
  and distinct diagnostic sizes. Scheduler shows its waiting notice and ranking
  without an init prompt. Proofs and screenshots:
  `/tmp/opencode/slow-service-v3-{guide,scheduler}-browser-proof.json` and
  `/tmp/opencode/slow-service-v3-{guide,scheduler}-browser.png`.
- `git diff --check` passes. Scheduler closure comparison against `ef8751f` is
  empty, and all 12 announcement files still match the parent's reviewed bundle.
  Review diff: `/tmp/opencode/slow-service-v3-public-staging.patch`.
  Changed-file hashes: `/tmp/opencode/slow-service-v3-changed-files.sha256.json`.

Remaining parent gates include complete-source/capped-runner calibration, both
efficient layouts receiving full credit, slower scans/full-copy scoring below
100, seeded capacity calibration, public-only frozen trials across seeds,
the fresh blind difficulty gate, trusted capacity and live protocol verification,
the production migration, explicit activation and announcement authorization.
No release action is implied by passing the public preparation checks.

The staged plan and ownership sketch are in `.audit/slow-service-v3.md`.
