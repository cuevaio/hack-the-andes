# Historical Slow Service v2 integration

This is the held v2 verification record. Current integration status is in
`.audit/integration.md`. The v2 difficulty gate failed and v2 was never released.

## Launch stopped

The approved public toolkit is integrated and verified, but this is an uncommitted change, not an approved release. The parent replaced the v1 draft with a correction-safe journal. The current version is `slow-service-v2`, slug `make-it-fast`, title `The Slow Service`. Keep `playable: false` until calibration, fresh blind trials and parent launch authorization are complete.

The parent reports that the actual R2 difficulty gate failed: all four fresh first submissions scored 100 on both seed sets. All were correct and faster than the reference. The parent records these results in `.audit/first-submission-grades-r2-a.jsonl` and `.audit/first-submission-grades-r2-b.jsonl`; this integration task did not open those private trial artifacts.

The parent's census in `.audit/premise-check.md` found the same persistent one-dimensional sum/min/count tree in all four solutions. The new accounting rules did not change the query representation. Passing 722 public repository tests and the standalone runner proof verifies the integration, not the required difficulty. Slow Service v2 must not be published, activated, pushed or announced. Tightening clocks to conceal this failure is not an approved remedy.

Preserve the verified v2 code, templates, version, contract and timing thresholds unchanged. No v3 design, bounds or contract are approved. Further integration changes wait for the parent's specific selection and kernel proof. All release actions remain blocked.

No commit, push, deployment, production migration or email is authorized here. Scheduler closure files match `ef8751fd863e5dbd7b0c0cc6a63e4df572beb023`. Historical attempts remain unchanged. Frozen trial and agent proof artifacts were not opened or edited. No hidden feedback was sent to participant agents.

## Current public contract

The approved v2 types are copied from the authorized `src/slow-service-v2/contract.ts`, not from a private implementation. They replace the v1 merchant/customer statistics. The public interface is `createLedger({ accounts })`, synchronous `amend({ id, expectedRevision, entry })`, and `report({ account, from, to, asOf })`.

An accepted amendment advances the ID revision and checkpoint by one. Conflicts and insolvency publish nothing. Solvency considers complete replacements and chronological timestamp groups. Diagnostics use setup account order, then the chosen account's earliest negative timestamp. Reports preserve accepted history and include the opening balance in their minimum. Empty ranges and matching-revision voids of absent IDs are valid.

Published limits include 2–1,024 configured accounts, 1–64 UTF-16-unit IDs, 31-bit timestamps, report boundaries through 2,147,483,648, 100,000 operations, 48,000 active journals and 180,000 accepted old/new leg edits. Source remains 32,768 UTF-8 bytes, with a 384 MiB guest heap, 512 KiB stack, 25-second CPU ceiling, 30-second wall deadline and 32 MiB output cap.

Six literal public scenarios each own setup, online operations and expected outputs. The web adapter passes setup separately to the runner and compares every amendment-result field and all five report fields. It never sends expected results to the guest. The approved starter passes all six scenarios in actual child QuickJS execution and in the compiled Node runner.

## Toolkit boundary

`packages/challenges-contract/src/slow-service/toolkit.generated.ts` now has `kind: "ready"`. `runner.ts` exports the approved setup-aware runner. The catalog remains closed. In the isolated preview fixture, scaffolding produces the approved file map without overwriting participant work, and free tests execute the v2 starter. No v1 runner or scaffold is served under v2.

The parent approved all six files in `src/slow-service-v2`: contract, starter, participant README, runner, participant tests and public benchmark. After explicit runner approval, `bun scripts/sync-slow-service-toolkit.ts /home/cueva/projects/chofex-challenges-difficulty/src/slow-service-v2` imported the complete toolkit. All six embedded participant sources compare byte-for-byte with those approved files. SHA-256 results are recorded in `/tmp/opencode/slow-service-v2-whitelist.log`. Only generated package.json and participant AGENTS.md supplement the whitelist. No reference, oracle, private scenario, evaluator or frozen source was imported.

`scripts/sync-slow-service-toolkit.ts` accepts only the approved `slow-service-v2` source directory and reads the six explicit files before writing generated artifacts. It copies participant contents unchanged, adapts only the web runner's contract import, and formats the generated package files. The approved runner uses native cwd-based QuickJS resolution and reflective child-process calls. Its guest heap remains 384 MiB; the separate Node host old-space limit is 512 MiB to accommodate valid maximum-width inputs. Optional `timeoutMs` includes host preparation and is bounded by the published 30-second wall limit.

The real package test runs `bun test ./.kit/ledger.test.ts`. The approved benchmark accepts base counts 1–12,000, defaults to 12,000 and measures 1,024 operations after population at N and 4N. `--max-history` requires base 12000 and fills both sizes to 180,000 accepted leg edits. Every completed output is checked against its public independent scanner. Success output reports peakRssMiB, derived from trusted peakRssBytes. Peak RSS is total Node and WASM process memory, not guest heap. Both previously skipped real-runner tests now execute in the full suite.

## Stable shell

Official submissions retain the version-1 `/api/v1/evaluate` envelope with `challengeVersion: "slow-service-v2"`. The public shell still owns source SHA persistence, five official evaluations, atomic reservations, rankings, eligibility and badge placement. It does not implement the parent-owned oracle, reference or calibration.

The standard score fields remain points-based: accuracy, exactCount, sampleSize, meanError, queriesUsed and diagnostic runtimeMs, with optional executionCost. The trusted challengeSlug marker preserves points, fewer official evaluations and earliest-best ordering without raw CPU tie-breaks. There is no journal-specific wire breakdown. Scheduler review and passkey approval do not apply to this challenge.

The six exact correctness groups award 60 points and unlock four efficiency families with 10/6/3/0 tiers. Any wrong result or candidate execution failure in any performance trace disables all 40 efficiency points, including other families. Correctness credit remains. The published trial sizes are 12,000 and 48,000 journals with 1,024 measured operations. Normalized growth is candidate CPU growth divided by reference CPU growth. Relative cost is candidate large-phase CPU divided by reference large-phase CPU. The published pairs are 1.8/3 for 10 points, 3.5/6 for 6 points, and 6/12 for 3 points. These display constants live in `slowServicePublicPerformance`; they are not a public grader. The parent may revise them before export only if calibration proves incoherent.

A Slow Service engine response without a score never consumes an official attempt, including explicit initialization failures. Other challenges keep their confirmed-solution-failure charging policy. The regression fixture first reproduced an initialization rejection consuming one attempt instead of zero; the narrow service change makes the same fixture pass and releases the reservation.

Existing Slow Service request budgets remain 330 seconds for the engine, 360 seconds for the web route and CLI request, and 390 seconds for reservations. The parent is checking the private 300-second limit plus 30-second child boundary against this request budget. Confirm total calibration time and production proxy compatibility before launch. Other challenges retain their original engine and CLI budgets.

## Verification

- `NEW_DATABASE_URL=postgresql://test:test@127.0.0.1:5432/test bun test`: 722 pass, zero skipped, zero failed, 8,306 assertions across 123 files. Log: `/tmp/opencode/slow-service-v2-tests.log`. This includes the real exported-toolkit installation/tests/benchmark and the parent-owned announcement tests.
- `bun run check-types`, `bun run lint` and `NEW_DATABASE_URL=postgresql://test:test@127.0.0.1:5432/test bun run build` pass. Logs: `/tmp/opencode/slow-service-v2-{types,lint,build}.log`. The build retains the existing ten font/badge tracing warnings and emits Node experimental Web Crypto warnings.
- `node scripts/verify-slow-service-build.mjs` passes under Node 24.21.0. It extracts unchanged compiled runner declarations from `apps_web_lib_challenges_service_ts_0kfd8b1._.js`, switches cwd to the standalone web package and verifies QuickJS resolves inside the standalone output. All six literal scenarios pass. Actual negative probes return `execution`, `budget`, `timeout` and `memory`. Valid-shaped wrong zero outputs complete instead of becoming infrastructure errors. A subsequent starter run passes, proving recovery. Log: `/tmp/opencode/slow-service-v2-standalone.log`. No private-engine success is claimed.
- An independently exported public package at `/tmp/opencode/slow-service-v2-verified-public-ZuThgI` installs QuickJS 0.32.0 and passes all five participant tests, ten assertions. Log: `/tmp/opencode/slow-service-v2-participant-tests.log`.
- `bun run benchmark ledger.js 1000` completes with exact outputs at 1,000 and 4,000 journals. Trusted peak RSS is 94.5 and 112.79296875 MiB respectively. CPU totals are 2,385.555 and 23,623.306 ms; phase CPU is 1,062.553 and 3,904.891 ms. These concurrent local verification measurements are diagnostic, not calibration or an official score. Log: `/tmp/opencode/slow-service-v2-benchmark.log`.
- `bun run benchmark ledger.js 12000 --max-history` confirms the published workload shape: 180,000 accepted leg edits at both 12,000 and 48,000 journals, with 51,768 and 69,768 operations. The slow starter returns structured `timeout` for both sizes and the benchmark exits 1. This is the documented starter limitation, not a valid speed or maximum-history RSS measurement. Optimized maximum-history completion/RSS proof remains parent-owned. Log: `/tmp/opencode/slow-service-v2-max-history.log`.
- Seven focused public-adapter tests pass, including repeated actual initialization failures releasing suite capacity and valid-shaped wrong zero answers receiving zero credit. The failing-before protocol fixture consumed one official attempt on initialization rejection; it now observes zero and releases the reservation. A completed standard 60-point score consumes an attempt without being mistaken for an infrastructure error.
- The PGlite flow fixture uses all real migrations and a localhost standard-score protocol stub. It verifies actual v2 scaffolding and free tests, engine outage recovery, initialization rejection, v2 source SHA persistence, draft exclusion, ranking, admission and badge. A synthetic v1 result remains stored but cannot rank or confer v2 eligibility. Official scoring here is protocol verification, not private-grader proof.
- The Scheduler closure files are unchanged relative to `ef8751f`. No new migration is needed for the v2 contract. Existing migration `0028_slow_service_rank.sql` remains a future launch requirement, not current permission to apply it.
- Final artifact comparison confirms the web contract is byte-identical to the approved contract and the web runner differs only in its contract import. The catalog still reports `playable: false`. `git diff --check` passes and HEAD remains `a3bdd954b01851d4eff1da67a1a468520b8f1ee6`.

## Revision touchpoints

| Concern | Files |
| --- | --- |
| Public domain types | `packages/challenges-contract/src/slow-service/contract.ts`, copied from the authorized parent contract. |
| Version, published display policy and small public scenarios | `packages/challenges-contract/src/slow-service.ts`. The engine version mapping already derives from its constant. |
| Approved scaffold artifacts | `scripts/sync-slow-service-toolkit.ts` and `packages/challenges-contract/src/slow-service/{toolkit.generated.ts,runner.ts}`. The six approved files are integrated. The CLI scaffold consumes the file map without interpreting journal fields. |
| Guide and workflow | `apps/web/components/challenges/slow-service-guide.tsx`, `apps/cli/src/challenge-commands.ts`, the local test hint in `apps/web/lib/challenges/service.ts`, and `skills/chofex-hackathon/references/slow-service.md`. |
| Setup-aware free tests | `apps/web/lib/challenges/slow-service-public.ts`, its test, and `packages/challenges-contract/src/slow-service.test.ts`. Injected outcomes test adapter wiring; separate real guest tests prove starter success and failure handling. |
| Catalog gate | `packages/challenges-contract/src/index.ts`. Preserve slug and `playable: false` throughout calibration and trials. |
| Compiled runtime proof | After approved artifacts and a fresh build, run `node scripts/verify-slow-service-build.mjs`. It uses unchanged compiled runner declarations and packaged QuickJS dependencies. Authenticated live API proof remains parent-owned. |

The parent independently reviewed and copied 12 announcement files from its approved bundle into this worktree. Paths include `apps/web/lib/emails/slow-service-announcement.ts`, `docs/announce-slow-service.md`, `scripts/announce-slow-service.ts` and `scripts/slow-service-announcement/`. These parent changes remain untouched. They are included in final root verification. A separate announcement test run passes 38 tests across its five test files; its explicit tsconfig passes `bunx tsc --noEmit -p scripts/slow-service-announcement/tsconfig.json`, and Biome checks all 11 code/config files without fixes. Logs: `/tmp/opencode/slow-service-v2-announcement-{tests,types,lint}.log`. No announcement command, production send or production write has been authorized or performed here.

Remaining release gates belong to the parent: optimized full-history/RSS proof, final calibration, fresh blind difficulty trials, authenticated live grading, engine warmup and request/proxy latency confirmation, production migration `0028`, explicit activation and announcement authorization. HEAD/branches remain untouched. The copied Scheduler closure is verified by file comparison, not by git ancestry; the parent still owns the feature commit and merge of origin/main before any fast-forward push. See `.audit/slow-service-v2.md` for the completed public integration plan.
