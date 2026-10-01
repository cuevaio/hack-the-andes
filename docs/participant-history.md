# Participant history and the attendance goal

The event goal is 100 people on site. The insights page should answer:

- How many people occupied each stage on a chosen date?
- Which stages are growing, and where is progress slowing?
- How many accepted people still need to confirm?
- How many confirmations are needed under an explicit attendance assumption?
- Which acquisition sources produce confirmed participants?

Historical counts must distinguish recorded facts from reconstructed state. Country and challenge filters need an explicit historical meaning. Remote participation must not count toward the on-site goal.

## Design

`/admin/insights/history` reconstructs daily, mutually exclusive stages from retained application and challenge evidence. It selects the latest application that existed at each cutoff, so reapplication does not rewrite previous days. Lima midnight defines day boundaries. Today is partial. Missing decision and withdrawal dates, and ambiguous legacy confirmation intervals, appear as insufficient history rather than invented transitions.

History uses current residence and today's challenge versions. A selected challenge fixes the current group and shows its earlier stages. The report does not claim to recover previous country values, past eligibility rules, deleted records, or arbitrary unrecorded edits.

The current global attendance goal is separate from historical filters. A valid on-site confirmation requires an accepted application, explicit in-person mode, recorded completion, and all required confirmation details. Check-ins remain a separate recorded measure. There is no operational check-in writer in this application.

Show-up percentage and optional cost per new confirmation are organizer-entered assumptions. The initial 100% is an optimistic scenario, not an observed rate. Required confirmations equal `ceil(100 / showUpRate)`. The remaining gap and accepted-but-unconfirmed pool identify the minimum additional acceptance effort. A target above 100 confirmations must be considered against the published capacity. No automatic admission or spending occurs.

We compared evidence reconstruction with five trigger-backed revision tables. Reconstruction was selected, 27/30 versus 23/30, because it answers the immediate question without adding a second persistence system. We kept the other design's separation of global goals, historical scope, and recorded check-ins. Mature-cohort conversion modeling and acquisition integrations are deferred until their data exists.

## Confirmation timing

Migration `0027` adds nullable `first_completed_at`. Existing completed rows remain null because earlier edits may have overwritten their original date. A new completion records both timestamps. Repeat confirmation preserves them atomically. The report's seven-day first-confirmation count only uses known first timestamps among currently valid on-site confirmations, with legacy timing gaps shown separately.

Apply the database migration before deploying the web change. No historical date backfill is performed.

## Investment evidence

Source attribution lives in PostHog rather than this database, and acquisition spend is not recorded. The report shows the confirmation backlog, ranked review queue, incomplete-challenge queue, and a user-entered cost scenario. It does not claim measured acquisition costs or recommend a channel budget.

## Delivery

Work is on `feat/participant-history-goal` in a separate worktree. The PR starts as a draft and receives verified increments. Cursor reviews the completed change; accepted findings are fixed before merge. Codex review is not required for this PR.
