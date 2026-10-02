# Participant funnel and residence filters

The participant page starts with a compact funnel summary again. It shows recorded application submissions and current-version challenge starts and evaluations, followed by decisions. Approval or rejection does not imply challenge completion.

The summary honors search, residence, and challenge scope before pagination. Selecting a status narrows the list while the summary retains the full filtered cohort.

Residence controls offer all participants, Peru, outside Peru, and unknown residence. Outside Peru means a recorded country other than `PE`; unknown residence remains separate. Existing exact-country links from the distribution report retain their precise scope and show that selection explicitly.

The separate current insights and historical attendance-planning pages remain available from the participant page.

## Verification

`apps/web/scripts/preview-participant-history.tsx` runs the actual participant dashboard and report components against isolated PGlite data with every migration applied. The fixture replaces Clerk authentication and Next.js image rendering. It uses the production list, ranking, and report readers.

The repeatable browser checks run against the fixture at `127.0.0.1:4321`:

```sh
bun apps/web/scripts/preview-participant-history.tsx
```

In another terminal:

```sh
bash apps/web/scripts/check-participant-funnel.sh
bash apps/web/scripts/check-participant-history.sh
```

The funnel check covers pagination, residence and status filters, country edits, sorting, browser back, search, empty results, exact-country challenge links, and 390px and 320px viewports. It also checks outside-Peru selection in both report pages. The history check covers attendance assumptions, dated reports, and mobile table scrolling.

Database tests verify that repeated evaluations count once, approval does not imply evaluation, and unknown residence stays separate from outside Peru. Repository verification uses:

```sh
NEW_DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:5432/fixture bun test
bun run lint
bun run check-types
NEW_DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:5432/fixture bun run build
```

The database URL satisfies module initialization. The tests supply their own isolated databases.
