import { mock } from "bun:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { currentChallengeVersionFor } from "../../challenges/engine";
import { parseCandidateFilters } from "../candidate-filters";

export const client = new PGlite();
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
for (let index = 1; index <= 26; index++) {
  await client.query(
    "insert into participants (id, clerk_user_id, name, country_code) values ($1,$2,$3,$4)",
    [
      id(index),
      `fixture-${index}`,
      `Persona ${index}`,
      index % 2 === 0 ? "CO" : "PE",
    ],
  );
  let status = "submitted";
  if (index === 1) status = "accepted";
  if (index === 13 || index === 24) status = "rejected";
  if (index === 25) status = "withdrawn";
  await client.query(
    "insert into applications (id,participant_id,first_name,email,status,submitted_at,created_at) values ($1,$1,$2,$3,$4,'2026-09-01','2026-09-01')",
    [id(index), `Persona ${index}`, `persona${index}@example.invalid`, status],
  );
  for (const [challengeIndex, slug] of [
    "black-box",
    "broken-agent",
  ].entries()) {
    const attemptId = id(100 + challengeIndex * 100 + index);
    const evaluationId = id(300 + challengeIndex * 100 + index);
    let version: string | undefined = currentChallengeVersionFor(slug);
    if (index === 26) version = "superseded-version";
    await client.query(
      "insert into challenge_attempts (id,participant_id,challenge_slug,challenge_version,share_code,queries_limit,evaluations_limit,evaluations_used,best_evaluation_id) values ($1,$2,$3,$4,$5,10,10,1,$6)",
      [
        attemptId,
        id(index),
        slug,
        version,
        `R${challengeIndex}${String(index).padStart(4, "0")}`,
        evaluationId,
      ],
    );
    let accuracy = 0.9 - Math.max(0, index - 2) / 100;
    if (slug === "broken-agent") accuracy = 0.65 + index / 100;
    await client.query(
      "insert into challenge_evaluations (id,attempt_id,solution_kind,solution,accuracy,exact_count,sample_size,mean_error,queries_used,runtime_ms,created_at) values ($1,$2,'javascript_source','{}',$3,$4,100,0,0,50,'2026-09-01')",
      [evaluationId, attemptId, accuracy, Math.round(accuracy * 100)],
    );
  }
}
await client.query(
  "insert into applications (id,participant_id,status,created_at) values ($1,$2,'draft','2026-09-02')",
  [id(1000), id(24)],
);
await client.query(
  "insert into participants (id,clerk_user_id,name) values ($1,'unranked','Sin resultado')",
  [id(27)],
);
await client.query(
  "insert into applications (id,participant_id,status,submitted_at) values ($1,$1,'submitted',now())",
  [id(27)],
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
mock.module("server-only", () => ({}));
mock.module("../../challenges/clock", () => ({
  currentChallengeTime: () => new Date("2026-08-01"),
  challengesForceOpen: () => false,
}));
mock.module("../../badges/acceptance", () => ({
  storeAcceptanceBadgeProfile: async () => {},
}));
mock.module("../../badges/enqueue", () => ({
  enqueueBadgeGeneration: async () => {},
}));
export const { listCandidates, decideCandidate } = await import(
  "../candidates"
);

if (import.meta.main) {
  const { getChallengeRanking } = await import("../../challenges/ranking");
  const unreleased = await getChallengeRanking(
    "black-box",
    new Date("2026-08-01"),
  );
  assert.equal(unreleased.entries.length, 0);
  const first = await listCandidates(
    parseCandidateFilters({ view: "ranking", ranking: "black-box" }),
  );
  assert.equal(first.total, 24);
  assert.equal(first.ranking?.competitorCount, 24);
  assert.equal(first.totalPages, 3);
  assert.equal(
    first.candidates[0]?.challenges.find(
      (challenge) => challenge.slug === "black-box",
    )?.rank,
    undefined,
  );
  assert.deepEqual(
    first.candidates.map((candidate) => candidate.rankingResult?.rank),
    [1, 1, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  const third = await listCandidates(
    parseCandidateFilters({ view: "ranking", ranking: "black-box", page: "3" }),
  );
  assert.deepEqual(
    third.candidates.map((candidate) => candidate.rankingResult?.rank),
    [21, 22, 23, 24],
  );
  assert.equal(third.candidates[3]?.id, id(1000));
  assert.equal(third.candidates[3]?.status, "draft");
  assert.equal(third.candidates[3]?.applicationHistory.length, 2);
  const peru = await listCandidates(
    parseCandidateFilters({
      view: "ranking",
      ranking: "black-box",
      country: "PE",
      page: "2",
    }),
  );
  assert.equal(peru.total, 12);
  assert.deepEqual(
    peru.candidates.map((candidate) => candidate.rankingResult?.rank),
    [21, 23],
  );
  const scheduler = await listCandidates(
    parseCandidateFilters({
      view: "ranking",
      ranking: "broken-agent",
      page: "3",
    }),
  );
  assert.equal(scheduler.total, 24);
  assert.deepEqual(
    scheduler.candidates.map((candidate) => candidate.rankingResult?.rank),
    [21, 22, 23, 24],
  );
  assert.ok(
    scheduler.candidates.every(
      (candidate) => (candidate.rankingResult?.score.accuracy ?? 1) < 0.95,
    ),
  );
  const publicBlackBox = await getChallengeRanking(
    "black-box",
    new Date("2026-10-03"),
  );
  assert.equal(publicBlackBox.entries.length, 20);
  const publicScheduler = await getChallengeRanking(
    "broken-agent",
    new Date("2026-10-03"),
  );
  assert.equal(publicScheduler.entries.length, 20);
  const ordinary = await listCandidates(parseCandidateFilters({}));
  assert.equal(ordinary.total, 26);
  assert.equal(ordinary.candidates[0]?.name, "Sin resultado");
  const empty = await listCandidates(
    parseCandidateFilters({
      view: "ranking",
      ranking: "make-it-fast",
      page: "2",
    }),
  );
  assert.deepEqual(
    [empty.total, empty.counts.all, empty.page, empty.ranking?.competitorCount],
    [0, 0, 1, 0],
  );
  const accepted = await decideCandidate({
    applicationId: id(2),
    decision: "accepted",
    notify: false,
    decidedByClerkUserId: "fixture-reviewer",
  });
  assert.equal(accepted.candidate.status, "accepted");
  const rejected = await decideCandidate({
    applicationId: id(3),
    decision: "rejected",
    notify: false,
    decidedByClerkUserId: "fixture-reviewer",
  });
  assert.equal(rejected.candidate.status, "rejected");
  const afterDecision = await listCandidates(
    parseCandidateFilters({
      view: "ranking",
      ranking: "black-box",
      status: "approved",
    }),
  );
  assert.deepEqual(
    afterDecision.candidates.map((candidate) => candidate.rankingResult?.rank),
    [1, 1],
  );
  await assert.rejects(() =>
    decideCandidate({
      applicationId: id(1000),
      decision: "accepted",
      notify: false,
      decidedByClerkUserId: "fixture-reviewer",
    }),
  );
  await assert.rejects(() =>
    decideCandidate({
      applicationId: id(27),
      decision: "accepted",
      notify: false,
      decidedByClerkUserId: "fixture-reviewer",
    }),
  );
  await client.close();
  console.log("candidate rankings passed");
}
