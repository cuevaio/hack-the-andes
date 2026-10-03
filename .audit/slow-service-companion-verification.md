# Slow Service companion verification

The user authorizes the v3 companion release without a human pilot. This record
describes local public-code verification, not production readiness or a claim
that an approval proves understanding or independent authorship.

## Behavior verified

- The actual CLI rejects a missing review, a stale source digest, a blocked
  decision, and a Scheduler-only focus. None submits an evaluation request.
  A valid v3 review produces one versioned JSON browser handoff.
- The API preserves the review through request parsing and returns HTTP 428 with
  the owned approval URL. PGlite runs the committed migrations and the actual
  service, approval, reservation, ranking, eligibility, and badge code.
- Approval routes reject CLI OAuth with HTTP 403, missing authentication with
  HTTP 401, and foreign ownership or missing approval with HTTP 404. Source
  snapshots reject tampering. Competing v3 consumers acquire one grant exactly
  once. Infrastructure failure releases the grant without charging an attempt.
- The local flow does not automate a participant's passkey or claim a human
  pilot. It marks the checked local approval row approved to exercise evaluation.
  Existing passkey tests exercise the shared ceremony and credential behavior.
- Scheduler closure and historical v1/v2 records remain unchanged. Tests reflect
  the newly playable third challenge in admin metrics and reminder selection.

## Toolkit and build

The full suite passes 731 tests with zero failures and 8,982 assertions across
124 files. Log: `/tmp/opencode/companion-worker-tests-release.log`.
The announcement suite separately passes 38 tests. No campaign was sent.
Logs for root lint and type checks are
`/tmp/opencode/companion-worker-{lint,types}-release.log`.

`bun scripts/verify-slow-service-source-exposure.ts
/tmp/opencode/slow-service-launch/slow-service-v3` verifies only the six approved
source names, exact exported bytes, formatted mirrors, and two generated extras.
It never enumerates or imports private engine files. The manifest is
`/tmp/opencode/companion-worker-source-manifest.json`.

| Approved source | SHA-256 |
| --- | --- |
| README.participant.md | 5900c7ec55b963f6b5941c7bfeaef631a3e99c1f002aa370f433d6e5def090c0 |
| starter.js | d94d041dcc503503c1516ee99e8694988d92807bfa0aa6b772c57f01a2cf0739 |
| contract.ts | a3b787e9bc829f2aea2b089b99f3036b39708162bd028cc1c718690d6d096d26 |
| runner.ts | 9455750442f21f57178c56c671abff6a679a0f703a96bba13ccac4c085182f70 |
| public-benchmark.ts | f972a586c55fbc83aedf03422adb17eeae2ea7dcd1c7e944f90dd3ff466fd014 |
| participant-tests.ts | b1d80009cc6edd3c91e9e7b4f4967907606d7f2f464e1a89441c477f908c1aaf |

The real CLI initializes the open challenge and exports eight exact files.
The exported package passes six participant tests and all eight public scenarios,
87 operations, in QuickJS. The reduced 20/80 benchmark verifies exact results and
trusted RSS. It is a diagnostic, not hidden performance calibration.
Log: `/tmp/opencode/companion-worker-toolkit.log`.

Root type checks, lint, and the actual CLI and standalone Next build pass.
The five public verification scripts also pass an explicit strict type check.
Build log: `/tmp/opencode/companion-worker-build-final.log`.
The compiled standalone runner passes eight scenarios plus execution, budget,
timeout, memory, invalid-output, recovery, and public-health probes. All 16 owned
children close before their awaited results return.
Log: `/tmp/opencode/companion-worker-compiled-final.log`.

The final standalone guide runs on `127.0.0.1:3229` with a read-only empty SELECT
fixture that rejects external fetches. Browser checks confirm the review command,
passkey handoff, responsibility statement, calibrated tiers, and no provisional
guide language. Scheduler remains closed, shows its waiting notice, and offers
no init command. Browser proofs and screenshots are under
`/tmp/opencode/companion-worker-{guide,scheduler}-browser*`.

The announcement tests preserve the frozen content hash
`137e13d2e53facf8f450b339508142eb9db1a9996459da5221bff7413eac1ca3`.
The example checker permits only the approved Slow Service init alias in the
frozen campaign files. Other legacy CLI examples remain rejected.

## Release boundary

No production calls, database writes, migrations, deployment, email sends, or
main pushes occurred in this verification task. The parent still owns the live
private-engine blocker, production checks, origin/main reconciliation, and push.
The preexisting public diff also activates `power-grid`; that unrelated hunk is
preserved for the parent's reconciliation, not verified as part of this release.

Parent reconciliation identifies the `power-grid` activation as an accidental
earlier parent edit, not user work. Removed it and added a catalog regression
covering both future dates and force-open. Only Slow Service is newly playable.

## Parent release verification

Reconciled with public main through `75f4ffe`, including Scheduler closure,
all participants scoring at least 95 percent, and the Qatom benefit change.
The conflict retained main's complete closed-ranking test, which includes the
draft's original assertions. The merged implementation passes 736 tests,
9,005 assertions, zero failures, root types, lint, CLI/Next build, source exposure,
and the actual compiled runner with all sixteen children closed.

The final private image `a282196` is verified by immutable tag and image ID.
Its cold reference evaluation returned an unchargeable 503 while calibration
prepared, with 298 successful health checks and zero failures. An explicit
recovery evaluation on that final image completed HTTP 200, score 100, in
130,995 ms. This proves the warmed evaluator, not a cold-start latency guarantee.
Runner, participant files, workloads, scoring thresholds and guest caps are
unchanged. Production migration 0028 is applied and directly verified.

Parent receipts are `/tmp/opencode/companion-parent-tests-merged.log`,
`companion-parent-{types,lint,build}-merged.log`,
`companion-parent-compiled-merged.json`, and
`companion-parent-final-image-recovery.jsonl`. The last audience dry run found
165 participants, 164 eligible and one suppressed, with zero emails sent.
Public deployment, published CLI and live catalog/guide checks precede sending.
