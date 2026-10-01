# Participant filters and insights

The participant list is for reviewing applications. A separate `/admin/insights` page shows aggregate progress without adding more controls to that list.

## Data rules

- Count each participant once, using the latest application. Exclude participants whose latest application is withdrawn.
- Country means residence. Keep unknown countries separate from Peru.
- Filter in the database before pagination and ranking. Status counts honor search and country, while ignoring the selected status.
- Count challenge activity on current playable versions. Multiple evaluations do not create extra participants.
- Measure actual challenge starts and completions. An approval or rejection does not prove challenge completion.

## Delivery

1. Consolidate URL parsing and add country filtering.
2. Replace the status-button strip with compact controls and visible active filters.
3. Add an authorized insights page with a funnel, country distribution, and challenge breakdowns.
4. Verify database counts, browser history, country corrections, keyboard use, and mobile layouts.
5. Request Codex and Cursor reviews, address findings, and merge after both reviews are clear.
