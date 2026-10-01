# Participant filters and insights

The participant list is for reviewing applications. A separate `/admin/insights` page shows aggregate progress without adding more controls to that list.

## Data rules

- Count each participant once, using the latest application. Exclude participants whose latest application is withdrawn.
- Country means residence. Keep unknown countries separate from Peru.
- Filter in the database before pagination and ranking. Status counts honor search and country, while ignoring the selected status.
- Count challenge activity on current playable versions. Multiple evaluations do not create extra participants.
- Measure actual challenge starts and completions. An approval or rejection does not prove challenge completion.

## Delivery

The list uses a compact row with search, status, and country. Sorting remains separate. Country is searchable; selected values remain visible. A reset clears filters but preserves sorting. This replaces the status-button strip and moves the large funnel to the insights page.

Compared with a single filter popover, inline controls need fewer interaction states and keep the current scope visible. The country combobox uses the existing Base UI pattern. One shared parser and serializer govern server requests, browser history, and cache identity.

The insights report uses server-rendered counts and charts from one database snapshot. Its optional challenge filter selects people who started that challenge's current version. Challenge progress survives a new application, so milestones are independent measurements rather than a strictly sequential conversion rate.

1. Consolidate URL parsing and add country filtering.
2. Replace the status-button strip with compact controls and visible active filters.
3. Add an authorized insights page with a funnel, country distribution, and challenge breakdowns.
4. Verify database counts, browser history, country corrections, keyboard use, and mobile layouts.
5. Request Codex and Cursor reviews, address findings, and merge after both reviews are clear.
