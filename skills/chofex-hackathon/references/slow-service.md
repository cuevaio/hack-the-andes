# The Slow Service

Read `challenge list` and `challenge show --challenge make-it-fast` before
starting. The slug is `make-it-fast`, the title is `The Slow Service`, and the
current version is `slow-service-v3`. It uses a human-agent companion workflow.
The agent may implement, explain and test. The participant chooses a concrete
failure case, checks actual evidence and approves the exact source in the browser.
Approval records responsibility, not understanding or independent authorship.
Do not submit v1 or v2 source under v3 or invent missing toolkit files.

When the live catalog shows the challenge open:

```sh
andes --output json challenge init --challenge make-it-fast
cd slow-service
bun install
bun test ./.kit/ledger.test.ts
bun run benchmark ledger.js 1000
andes --output json challenge test --challenge make-it-fast --source ./ledger.js
```

The generated README is the normative contract. `createLedger({ accounts })`
receives configured account IDs and opening balances. Its synchronous
`amend({ id, expectedRevision, entry })` replaces or voids one entire entry.
`report({ account, from, to, asOf, percentile })` returns exactly opening, net,
closing, entries, minimumBalance, debits and debitAmountAtPercentile for an
accepted historical checkpoint. Journal entries have no party labels.

Current revision starts at zero and expectedRevision must equal it exactly.
A successful amendment advances this ID's revision and the global checkpoint
by one. A conflict or insolvency changes nothing, including history and
tombstones. Voiding an absent or already-voided ID succeeds at its matching
revision. A complete replacement is tested only after both old removal and
new addition. Balances must stay nonnegative at every chronological timestamp
group. Select the first insolvent account in setup order, then its earliest
negative timestamp and balance.

Reports use `[from, to)`. Opening includes all earlier deltas. The minimum
includes opening and balances after whole timestamp groups. Canceling deltas
do not cancel entry counts. Empty intervals are valid. Old checkpoints never
change. The guest receives one current operation at a time, not future input.

`percentile` is an integer from 1 to 100. Select the positive magnitude at rank
`ceil(debits * percentile / 100)` from the sorted negative legs for that account,
interval and checkpoint, with multiplicity. The 50th percentile of [100, 300]
is 100, not their average 200. The 100th percentile is the maximum. Credits do
not enter the distribution. Equal timestamps and equal amounts still count as
separate debit observations. Accounting solvency still combines timestamp cohorts.
If there are no debits, `debits` is 0 and `debitAmountAtPercentile` is null,
including empty ranges. Rejection must preserve the distribution as well as
balances, revisions and accepted history. Replacing, moving, reversing or
voiding an entry changes only subsequent checkpoints.

Limits include 2–1,024 configured accounts with distinct IDs, opaque IDs of
1–64 UTF-16 units, opening balances
up to 10^12, nonzero leg deltas up to ±10^9 and 2–8 unique configured accounts
per entry with exact sum zero. Timestamps are 0–2,147,483,647 and report
boundaries extend to 2,147,483,648. Each trace has at most 100,000 operations,
24,000 active entries and 72,000 accepted old/new leg edits. `debits` is an
integer from 0 to entries. A non-null selected magnitude is an integer from
1 to 1,000,000,000.

The source cap is 32,768 UTF-8 bytes. Use a named createLedger or
`module.exports = { createLedger }`, with
no imports, ESM exports, external dependencies or host APIs. QuickJS is pinned
to 0.32.0, with a 640 MiB guest heap, 512 KiB stack, 25-second CPU ceiling,
30-second wall deadline and 32 MiB output cap. Checkpoints are safety-only.
The API separately caps the complete JSON request at 65,536 bytes, including
escaped source and the review. A source within its own cap can exceed the request
cap after JSON escaping. Reduce that request rather than bypassing the limit.

Persistence costs retained memory for balances and debit distributions. The
approved benchmark must verify each output and report total CPU, phase CPU and
trusted child peakRssBytes. RSS includes Node and WASM, not just guest heap.
Compact structures are an option, not a secret requirement. Preserve `.kit`,
package.json and bun.lock. Bun 1.3.14 and Node 24+ on Linux or macOS are required.

The approved v3 benchmark accepts integer base counts from 1 to 6,000, with
6,000 as the default. For full-size checks, use:

```sh
bun run benchmark ledger.js 6000
bun run benchmark ledger.js 6000 --max-history
bun run benchmark ledger.js 6000 --max-history --negative-heavy
```

The first command compares 6,000 and 24,000 journals with 1,024 later operations.
`--max-history` requires base 6000 and reaches 72,000 accepted leg edits.
`--negative-heavy` requires that flag and base 6000. It uses 2,000 and 8,000
journals with eight legs, seven negative and one positive, reaching 63,000
accepted debit edits within the 72,000 leg-edit cap. These smaller sizes are
local memory diagnostics, not the official 6,000/24,000 efficiency sizes.
Amounts span broad domains and reports vary percentiles from 1 to 100. The
benchmark exposes `negativeHeavy`, `acceptedLegEdits` and `acceptedDebitEdits`
alongside exact-output checks, phase CPU and trusted peakRssMiB. A memory, budget
or timeout outcome is not a valid speed measurement. Small tests do not prove
that history fits. Do not borrow v2 files or its old benchmark limits.

Six exact correctness groups award 10 points each and unlock four efficiency
families with 10/6/3/0 tiers. A wrong output or runtime failure in a performance
trace disables all efficiency. Calibrated phase sizes are 6,000 and 24,000 entries, N
and 4N, with 1,024 measured amendments and reports after population. Population
is outside the measured phase but still subject to time and memory limits.

Normalized growth is the candidate's large/small phase CPU ratio divided by
the reference's same ratio. Relative cost is candidate large-phase CPU divided
by reference large-phase CPU. Both limits must pass:

| Points per family | Maximum normalized growth | Maximum relative cost |
| --- | --- | --- |
| 10 | 1.8 | 3 |
| 6 | 3.5 | 6 |
| 3 | 6 | 12 |
| 0 | Outside all tiers | |

These are the calibrated v3 thresholds. Reference CPU uses medians of three
executions; near-threshold measurements repeat. Local CPU measurements do not
certify an official score or a participant's understanding.

Efficiency also requires exact reports at maximum history: 24,000 journals or
eight-leg entries accumulating 63,000 accepted debit edits. Both cases reach
72,000 accepted leg edits and may configure 1,024 accounts with 64-unit UTF-16
IDs. These capacity checks add no correctness groups or points. The same
640 MiB guest heap, 25-second CPU and 30-second wall limits cover the entire
execution. Wrong output, time or memory failure retains earned correctness
points but disables all 40 efficiency points. The public max-history commands
check these bounds locally; passing them does not certify official scoring.
Local benchmarks do not certify hidden performance. A failed
performance trace removes all 40 efficiency points, including other families.
Passing all correctness groups still earns 60. Server errors and rejected
initialization do not consume an official attempt.

There are five official evaluations. The participant chooses a failure scenario,
checks real inputs and results, and decides whether to ship or block. AI help is
allowed for implementation and review, but never invent evidence or decide for
the participant. Follow the generated README's review format with `sourceDigest`,
`focus`, `failureScenario`, `evidence`, `decision`, `confidence` and `remainingRisk`.
Compute the SHA-256 from the exact UTF-8 bytes of ledger.js. A changed source needs
a fresh review. `block` stops evaluation without an engine call or budget usage.

The first reviewed evaluation returns a versioned 428 human-action envelope with
`approvalUrl`. Hand that URL to the participant. Only the participant opens it,
checks the exact source and review, and approves with their browser passkey. Do
not automate the passkey ceremony or open it as an agent. Repeat the same command
after approval and before expiry. Approval is source-bound and single-use;
waiting and infrastructure errors do not consume an evaluation. An evaluation
may take several minutes.

```sh
andes --output json challenge evaluate --challenge make-it-fast --source ./ledger.js --review ./review.json
andes --output json challenge ranking --challenge make-it-fast
andes --output json status
```

The ranking uses points, fewer official evaluations, then earliest best
submission, not CPU milliseconds. A submitted application is required to
rank. A ranked result does not promise acceptance. Historical versions and
the closed Scheduler remain unchanged.
