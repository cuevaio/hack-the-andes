# Slow Service v2 integration plan

## Phases

- [x] Ground the existing public shell and read the authorized v2 contract and chosen design.
- [x] Sketch the v2 types, public scenarios and pending toolkit boundary.
- [x] Use the parent's selected design. No additional agents or competing implementations are needed.
- [x] Replace v1 domain types, examples, version and public guide.
- [x] Verify the shell, historical exclusion and Scheduler closure without private grading code.
- [x] Review the five approved participant-safe files and align the guides with the frozen public trial policy.
- [x] Integrate all six parent-approved participant-safe files after explicit runner approval.
- [x] Run final root typecheck, lint, build and tests, including the parent's 12 reviewed announcement files without edits.
- [x] Exercise unchanged compiled runner declarations under standalone Node with packaged QuickJS, literal scenarios and negative probes.

## Ownership and call flow

The CLI sends only source through the existing evaluation envelope. The web service owns admission, attempts, source SHA, reservations and rankings. The engine adapter selects the current version from the shared contract and retains the standard score envelope. None of those modules interprets journal entries.

The public test handler owns small, literal scenarios. Each scenario has its own `LedgerSetup`, online `LedgerOperation` list and exact `LedgerResult` list. The runner receives setup separately from operations, calls `createLedger(setup)` once inside its child guest, then delivers one amendment or report at a time. No complete trace reaches the guest.

The authoritative domain types come from the approved `src/slow-service-v2/contract.ts`. All six participant files are approved and imported by the whitelist sync. Each embedded participant source matches its approved original byte-for-byte. The public runner executes actual guest code and the toolkit is `ready`, but the catalog remains closed. The official protocol fixture exercises reservations against a localhost score stub, not the private grader.

## Revision boundary

Replace the v1 merchant/customer model rather than add journal methods to it. Keep slug `make-it-fast`, title `The Slow Service`, five official evaluations, standard score fields, source digest, ranking order and the gated catalog. Set only the current version to `slow-service-v2`; preserve historical attempts and Scheduler closure from `ef8751f`.

Scoring has six exact correctness groups worth 10 points each and four efficiency families with 10/6/3/0 tiers. The published trial phase is 12,000 and 48,000 journals plus 1,024 operations. Tier pairs are normalized growth / relative CPU: 1.8/3, 3.5/6 and 6/12. The approved max-history benchmark requires base 12000 and reaches 180,000 accepted leg edits. It reports peakRssMiB from trusted peakRssBytes, not guest heap. The parent owns actual-runner calibration, remaining budget consistency and fresh blind trials.

No commits, pushes, deployments, production migrations, email sends or frozen trial changes are authorized.

Final full suite: 722 tests pass, zero skipped or failed. Root typecheck, lint and
production build pass. The standalone compiled runner passes all six scenarios,
returns the four structured failure reasons, completes valid-shaped wrong outputs,
and recovers afterward. The exported public package passes five participant tests
and returns exact benchmark outputs with trusted RSS at 1,000/4,000 journals.
Its maximum-history workloads both reach 180,000 accepted leg edits, but the slow
starter times out. Optimized maximum-history completion/RSS, final calibration,
fresh blind trials and release actions remain parent-owned. Announcement files
are untouched; their 38 current local tests, explicit typecheck and Biome checks
pass. Detailed commands, logs and limitations are in `.audit/integration.md`.
