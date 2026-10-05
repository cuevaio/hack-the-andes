import { mock } from "bun:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { parseCandidateFilters } from "../candidate-filters";

const client = new PGlite();
const migrations = new URL(
  "../../../../../packages/db/drizzle/",
  import.meta.url,
);
for (const file of (await readdir(migrations))
  .filter((name) => name.endsWith(".sql"))
  .sort()) {
  await client.exec(await readFile(new URL(file, migrations), "utf8"));
}
const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
for (let index = 1; index <= 15; index++) {
  let country: string | null = "PE";
  if (index > 12) country = "CO";
  if (index === 15) country = null;
  await client.query(
    "insert into participants (id, clerk_user_id, name, country_code) values ($1, $2, $3, $4)",
    [id(index), `fixture-${index}`, `Person ${index}`, country],
  );
  await client.query(
    "insert into applications (id, participant_id, first_name, status, submitted_at, created_at) values ($1, $1, $2, $3, now(), $4)",
    [
      id(index),
      `Person ${index}`,
      index === 1 ? "accepted" : "submitted",
      `2026-09-${String(index).padStart(2, "0")}T00:00:00Z`,
    ],
  );
}
await client.query(
  "insert into applications (participant_id, status, created_at) values ($1, 'rejected', '2026-08-01')",
  [id(1)],
);

mock.module("@chofex/db", () => ({ db: drizzle(client) }));
mock.module("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: {
      getUser: async () => ({
        createdAt: Date.parse("2026-08-01"),
        emailAddresses: [],
      }),
    },
  }),
}));
mock.module("../../challenges/service", () => ({
  challengeActivityForParticipants: async () => ({
    progressByParticipant: new Map(),
    milestonesByParticipant: new Map(),
  }),
}));
mock.module("../../challenges/ranking", () => ({
  rankedEvaluationsFor: async () =>
    [13, 1, 3].map((value, index) => ({
      participantId: id(value),
      attemptId: id(value),
      shareCode: `fixture${value}`,
      evaluatedAt: new Date("2026-09-01"),
      score: {
        accuracy: 0.9 - index * 0.1,
        exactCount: 9 - index,
        sampleSize: 10,
        meanError: index,
        queriesUsed: 0,
        runtimeMs: 1,
      },
    })),
}));
mock.module("../../badges/enqueue", () => ({
  enqueueBadgeGeneration: async () => {},
}));

const { listCandidates } = await import("../candidates");
await client.query("update participants set country_code='BR' where id=$1", [
  id(14),
]);
const outside = await listCandidates(
  parseCandidateFilters({ country: "outside_peru" }),
);
assert.equal(outside.total, 2);
assert.equal(outside.counts.all, 2);
assert.deepEqual(
  outside.candidates.map((candidate) => candidate.participantId),
  [id(14), id(13)],
);
await client.query("update participants set country_code='CO' where id=$1", [
  id(14),
]);
const first = await listCandidates(parseCandidateFilters({ country: "PE" }));
assert.equal(first.total, 12);
assert.equal(first.counts.all, 12);
assert.equal(first.counts.approved, 1);
assert.deepEqual(first.funnel, {
  submitted: 12,
  challengeStarted: 0,
  challengeCompleted: 0,
});
assert.equal(first.totalPages, 2);
assert.deepEqual(
  first.candidates.map((person) => person.participantId),
  [12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map(id),
);
const second = await listCandidates(
  parseCandidateFilters({ country: "PE", page: "2" }),
);
assert.deepEqual(
  second.candidates.map((person) => person.participantId),
  [id(2), id(1)],
);
const approved = await listCandidates(
  parseCandidateFilters({ country: "PE", status: "approved" }),
);
assert.equal(approved.total, 1);
assert.equal(approved.counts.all, 12);
assert.deepEqual(approved.funnel, {
  submitted: 12,
  challengeStarted: 0,
  challengeCompleted: 0,
});
assert.equal(approved.candidates[0]?.participantId, id(1));
const search = await listCandidates(
  parseCandidateFilters({ country: "PE", q: "Person 1" }),
);
assert.equal(search.total, 4);
assert.equal(search.counts.all, 4);
const unknown = await listCandidates(
  parseCandidateFilters({ country: "unknown" }),
);
assert.equal(unknown.total, 1);
assert.equal(unknown.candidates[0]?.participantId, id(15));
const ranked = await listCandidates(
  parseCandidateFilters({ country: "PE", ranking: "black-box" }),
);
assert.equal(ranked.total, 12);
assert.deepEqual(
  ranked.candidates.map((person) => person.participantId),
  [1, 3, 12, 11, 10, 9, 8, 7, 6, 5].map(id),
);

const rankingView = await listCandidates(
  parseCandidateFilters({
    view: "ranking",
    ranking: "black-box",
    country: "PE",
  }),
);
assert.equal(rankingView.total, 2);
assert.equal(rankingView.counts.all, 2);
assert.equal(rankingView.counts.approved, 1);
assert.equal(rankingView.ranking?.competitorCount, 3);
assert.deepEqual(
  rankingView.candidates.map((candidate) => [
    candidate.participantId,
    candidate.rankingResult?.rank,
  ]),
  [
    [id(1), 2],
    [id(3), 3],
  ],
);
assert.equal(rankingView.candidates[0]?.rankingResult?.score.accuracy, 0.8);
const filteredRanking = await listCandidates(
  parseCandidateFilters({
    view: "ranking",
    ranking: "black-box",
    status: "approved",
  }),
);
assert.equal(filteredRanking.total, 1);
assert.equal(filteredRanking.counts.all, 3);
assert.equal(filteredRanking.candidates[0]?.rankingResult?.rank, 2);
const emptyRanking = await listCandidates(
  parseCandidateFilters({
    view: "ranking",
    ranking: "black-box",
    q: "does not exist",
    page: "4",
  }),
);
assert.deepEqual(
  [emptyRanking.total, emptyRanking.page, emptyRanking.totalPages],
  [0, 1, 1],
);

const { currentChallengeVersionFor } = await import("../../challenges/engine");
await client.query(
  "insert into challenge_attempts (participant_id, challenge_slug, challenge_version, share_code, queries_limit, evaluations_limit) values ($1, 'broken-agent', $2, 'fixture3', 10, 10)",
  [id(3), currentChallengeVersionFor("broken-agent")],
);
await client.query(
  "insert into challenge_attempts (participant_id, challenge_slug, challenge_version, share_code, queries_limit, evaluations_limit) values ($1, 'black-box', $2, 'fixture1', 10, 10), ($3, 'black-box', 'old-version', 'fixture2', 10, 10)",
  [id(1), currentChallengeVersionFor("black-box"), id(2)],
);
const cohort = await listCandidates(
  parseCandidateFilters({ country: "PE", challenge: "black-box" }),
);
assert.equal(cohort.total, 1);
assert.equal(cohort.counts.all, 1);
assert.equal(cohort.candidates[0]?.participantId, id(1));
assert.deepEqual(cohort.funnel, {
  submitted: 1,
  challengeStarted: 1,
  challengeCompleted: 0,
});
await client.query(
  "insert into challenge_evaluations (attempt_id,solution_kind,solution,accuracy,exact_count,sample_size,mean_error,queries_used,runtime_ms) select a.id,'javascript','{}',0,0,10,1,0,1 from challenge_attempts a cross join generate_series(1,2) where a.participant_id=$1",
  [id(1)],
);
const evaluated = await listCandidates(
  parseCandidateFilters({ country: "PE", status: "approved" }),
);
assert.equal(evaluated.total, 1);
assert.deepEqual(evaluated.funnel, {
  submitted: 12,
  challengeStarted: 2,
  challengeCompleted: 1,
});
const brokenOnly = await listCandidates(
  parseCandidateFilters({ country: "PE", challenge: "broken-agent" }),
);
assert.deepEqual(brokenOnly.funnel, {
  submitted: 1,
  challengeStarted: 1,
  challengeCompleted: 0,
});
await client.query("update applications set submitted_at=null where id=$1", [
  id(1),
]);
const missingSubmission = await listCandidates(
  parseCandidateFilters({ country: "PE" }),
);
assert.deepEqual(missingSubmission.funnel, {
  submitted: 11,
  challengeStarted: 2,
  challengeCompleted: 1,
});
await client.query("update applications set submitted_at=now() where id=$1", [
  id(1),
]);

await client.query(
  "update participants set country_code = 'CO' where id = $1",
  [id(1)],
);
await client.query(
  "update participants set country_code = 'CO' where id = $1",
  [id(2)],
);
const corrected = await listCandidates(
  parseCandidateFilters({ country: "PE", page: "2" }),
);
assert.equal(corrected.page, 1);
assert.equal(corrected.total, 10);
assert.equal(corrected.counts.approved, 0);
assert.deepEqual(corrected.funnel, {
  submitted: 10,
  challengeStarted: 1,
  challengeCompleted: 0,
});
const outsideCorrected = await listCandidates(
  parseCandidateFilters({ country: "outside_peru", status: "approved" }),
);
assert.equal(outsideCorrected.total, 1);
assert.equal(outsideCorrected.counts.all, 4);
assert.deepEqual(outsideCorrected.funnel, {
  submitted: 4,
  challengeStarted: 1,
  challengeCompleted: 1,
});
assert.equal(outsideCorrected.candidates[0]?.participantId, id(1));
await client.query(
  "update applications set status = 'withdrawn' where id = $1",
  [id(1)],
);
const colombia = await listCandidates(parseCandidateFilters({ country: "CO" }));
assert.deepEqual(
  colombia.candidates.map((person) => person.participantId),
  [14, 13, 2].map(id),
);
const all = await listCandidates(parseCandidateFilters({}));
assert.equal(all.total, 14);
const empty = await listCandidates(parseCandidateFilters({ country: "AR" }));
assert.deepEqual(
  [
    empty.total,
    empty.counts.all,
    empty.page,
    empty.totalPages,
    empty.candidates.length,
  ],
  [0, 0, 1, 1, 0],
);
await client.close();
console.log("candidate filters passed");
