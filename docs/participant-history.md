# Participant history and the attendance goal

The event goal is 100 people on site. The insights page should answer:

- How many people occupied each stage on a chosen date?
- Which stages are growing, and where is progress slowing?
- How many accepted people still need to confirm?
- How many confirmations are needed under an explicit attendance assumption?
- Which acquisition sources produce confirmed participants?

Historical counts must distinguish recorded facts from reconstructed state. Country and challenge filters need an explicit historical meaning. Remote participation must not count toward the on-site goal.

The implementation will use persisted lifecycle evidence where available and state any coverage limits. Planning assumptions must be editable and clearly labeled. Acquisition and spending recommendations must not invent missing spend or attribution data.

## Delivery

Work is on `feat/participant-history-goal` in a separate worktree. The PR starts as a draft and receives verified increments. Cursor reviews the completed change; accepted findings are fixed before merge. Codex review is not required for this PR.
