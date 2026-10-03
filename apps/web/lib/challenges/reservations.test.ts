import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  completeEvaluationReservation,
  completeQueryReservation,
  consumeFailedEvaluationReservation,
  findChallengeObservation,
  type ReservationDatabase,
  releaseChallengeReservation,
  reserveChallengeUse,
} from "./reservations";

const migration = [
  "0010_strong_blackheart.sql",
  "0011_boring_bushwacker.sql",
  "0018_rank_challenge_runtime.sql",
  "0022_burly_mesmero.sql",
  "0024_broken_agent_rank.sql",
  "0028_slow_service_rank.sql",
  "0030_idempotent_slow_service_evaluation.sql",
]
  .map((name) =>
    readFileSync(
      new URL(`../../../../packages/db/drizzle/${name}`, import.meta.url),
      "utf8",
    ),
  )
  .join("\n")
  .replaceAll("--> statement-breakpoint", "");

describe("challenge reservations", () => {
  let client: PGlite;
  let database: ReservationDatabase;
  let attemptId: string;

  beforeEach(async () => {
    client = new PGlite();
    await client.exec(`
      create table challenge_attempts (
        id uuid primary key,
        challenge_slug varchar(64) not null default 'black-box',
        share_code varchar(8) not null,
        queries_used integer default 0 not null,
        queries_limit integer not null,
        evaluations_used integer default 0 not null,
        evaluations_limit integer not null,
        best_evaluation_id uuid,
        updated_at timestamp with time zone default now() not null
      );
      create table challenge_observations (
        id uuid primary key default gen_random_uuid(),
        attempt_id uuid not null references challenge_attempts(id),
        sequence integer not null,
        input jsonb not null,
        output jsonb not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        unique (attempt_id, sequence)
      );
      create table challenge_evaluations (
        id uuid primary key default gen_random_uuid(),
        attempt_id uuid not null references challenge_attempts(id),
        solution_kind varchar(32) not null,
        solution jsonb not null,
        accuracy double precision not null,
        exact_count integer not null,
        sample_size integer not null,
        mean_error double precision not null,
        queries_used integer not null,
        runtime_ms integer not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null
      );
      create index challenge_evaluations_ranking_index on challenge_evaluations (
        attempt_id,
        accuracy,
        exact_count,
        queries_used,
        runtime_ms
      );
    `);
    await client.exec(migration);
    const drizzleDatabase = drizzle(client);
    database = drizzleDatabase as unknown as ReservationDatabase;
    attemptId = crypto.randomUUID();
    await client.query(
      `insert into challenge_attempts (
        id,
        share_code,
        queries_limit,
        evaluations_limit
      ) values ($1, 'ABCD', 25, 3)`,
      [attemptId],
    );
  });

  afterEach(async () => {
    await client.close();
  });

  test("bounds concurrent work and commits only persisted queries", async () => {
    const reservations = await Promise.all(
      Array.from({ length: 30 }, () =>
        reserveChallengeUse(attemptId, "query", database),
      ),
    );
    const admitted = reservations.filter(
      (reservation) => reservation !== undefined,
    );
    expect(admitted).toHaveLength(25);

    const first = admitted[0];
    const second = admitted[1];
    if (!first || !second) throw new Error("missing reservations");
    await releaseChallengeReservation(first, "query", database);
    const completed = await completeQueryReservation(
      second,
      { distanceKm: 10 },
      42,
      database,
    );
    expect(completed?.queriesUsed).toBe(1);
    expect(completed?.observation.sequence).toBe(1);

    const replacement = await reserveChallengeUse(attemptId, "query", database);
    expect(replacement?.queriesUsed).toBe(1);
  });

  test("keeps budget when observation persistence fails", async () => {
    const reservation = await reserveChallengeUse(attemptId, "query", database);
    if (!reservation) throw new Error("missing reservation");
    await client.exec("drop table challenge_observations");

    await expect(
      completeQueryReservation(reservation, { distanceKm: 10 }, 42, database),
    ).rejects.toThrow();
    const result = await client.query<{
      queries_used: number;
      queries_pending: number;
    }>(
      "select queries_used, queries_pending from challenge_attempts where id = $1",
      [attemptId],
    );
    expect(result.rows[0]).toEqual({ queries_used: 0, queries_pending: 1 });

    await releaseChallengeReservation(reservation, "query", database);
    const replacement = await reserveChallengeUse(attemptId, "query", database);
    expect(replacement).toBeDefined();
  });

  test("recognizes repeated inputs and keeps their query budget", async () => {
    const input = {
      distanceKm: 10,
      weightKg: 3,
      hour: 14,
      fragile: false,
      express: false,
    };
    const first = await reserveChallengeUse(attemptId, "query", database);
    if (!first) throw new Error("missing reservation");
    await completeQueryReservation(first, input, 42, database);

    const existing = await findChallengeObservation(attemptId, input, database);
    expect(existing?.output).toBe(42);
    expect(
      await findChallengeObservation(
        attemptId,
        { ...input, distanceKm: 11 },
        database,
      ),
    ).toBeUndefined();

    const duplicate = await reserveChallengeUse(attemptId, "query", database);
    if (!duplicate) throw new Error("missing duplicate reservation");
    await expect(
      completeQueryReservation(duplicate, input, 42, database),
    ).rejects.toThrow();
    await releaseChallengeReservation(duplicate, "query", database);

    const result = await client.query<{
      queries_used: number;
      queries_pending: number;
    }>(
      "select queries_used, queries_pending from challenge_attempts where id = $1",
      [attemptId],
    );
    expect(result.rows[0]).toEqual({ queries_used: 1, queries_pending: 0 });
  });

  test("keeps sequences monotonic while old workers are still running", async () => {
    const oldWorkerUpdate = await client.query<{
      queries_used: number;
      query_sequence: number;
    }>(
      `update challenge_attempts
      set queries_used = queries_used + 1
      where id = $1
      returning queries_used, query_sequence`,
      [attemptId],
    );
    const oldWorker = oldWorkerUpdate.rows[0];
    if (!oldWorker) throw new Error("missing attempt");
    expect(oldWorker.query_sequence).toBe(oldWorker.queries_used);
    await client.query(
      `insert into challenge_observations (
        attempt_id,
        sequence,
        input,
        output
      ) values ($1, $2, '{}', '1')`,
      [attemptId, oldWorker.queries_used],
    );

    const reservation = await reserveChallengeUse(attemptId, "query", database);
    if (!reservation) throw new Error("missing reservation");
    const completed = await completeQueryReservation(
      reservation,
      { distanceKm: 20 },
      2,
      database,
    );
    expect(completed?.observation.sequence).toBe(2);
  });

  test("database limits protect reservations from old workers", async () => {
    const queryReservations = await Promise.all(
      Array.from({ length: 25 }, () =>
        reserveChallengeUse(attemptId, "query", database),
      ),
    );
    expect(queryReservations.every(Boolean)).toBe(true);
    await expect(
      client.query(
        `update challenge_attempts
        set queries_used = queries_used + 1
        where id = $1`,
        [attemptId],
      ),
    ).rejects.toThrow("challenge query limit exceeded");

    const evaluationReservations = await Promise.all(
      Array.from({ length: 3 }, () =>
        reserveChallengeUse(attemptId, "evaluation", database),
      ),
    );
    expect(evaluationReservations.every(Boolean)).toBe(true);
    await expect(
      client.query(
        `update challenge_attempts
        set evaluations_used = evaluations_used + 1
        where id = $1`,
        [attemptId],
      ),
    ).rejects.toThrow("challenge evaluation limit exceeded");
  });

  test("reclaims expired reservations after process termination", async () => {
    const reservations = await Promise.all(
      Array.from({ length: 25 }, () =>
        reserveChallengeUse(attemptId, "query", database),
      ),
    );
    expect(reservations.every(Boolean)).toBe(true);
    await client.query(
      "update challenge_reservations set expires_at = now() - interval '1 second'",
    );

    const replacement = await reserveChallengeUse(attemptId, "query", database);
    expect(replacement).toBeDefined();
    const result = await client.query<{
      queries_used: number;
      queries_pending: number;
    }>(
      "select queries_used, queries_pending from challenge_attempts where id = $1",
      [attemptId],
    );
    expect(result.rows[0]).toEqual({ queries_used: 0, queries_pending: 1 });
  });

  test("keeps Slow Service reservations beyond cold calibration and the engine timeout", async () => {
    const reservedAt = Date.now();
    const reservation = await reserveChallengeUse(
      attemptId,
      "evaluation",
      database,
      390_000,
    );
    if (!reservation) throw new Error("missing reservation");
    const result = await client.query<{ expires_at: Date }>(
      "select expires_at from challenge_reservations where id = $1",
      [reservation.id],
    );
    const expiresAt = result.rows[0]?.expires_at.getTime();
    if (expiresAt === undefined) throw new Error("missing reservation expiry");
    expect(expiresAt).toBeGreaterThanOrEqual(reservedAt + 390_000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 390_000);
    await releaseChallengeReservation(reservation, "evaluation", database);
    expect(
      (await client.query("select * from challenge_reservations")).rows,
    ).toEqual([]);
  });

  test("atomically persists successful and confirmed failed evaluations", async () => {
    const successful = await reserveChallengeUse(
      attemptId,
      "evaluation",
      database,
    );
    if (!successful) throw new Error("missing reservation");
    const completion = await completeEvaluationReservation(
      successful,
      { kind: "javascript_source", source: "return 42" },
      {
        accuracy: 1,
        exactCount: 1_000,
        sampleSize: 1_000,
        meanError: 0,
        queriesUsed: 10,
        runtimeMs: 5,
      },
      database,
    );
    expect(completion?.evaluationsUsed).toBe(1);

    const failed = await reserveChallengeUse(attemptId, "evaluation", database);
    if (!failed) throw new Error("missing reservation");
    const failedCompletion = await consumeFailedEvaluationReservation(
      failed,
      database,
    );
    expect(failedCompletion?.evaluationsUsed).toBe(2);

    const result = await client.query<{
      evaluations: number;
      best_evaluation_id: string | null;
    }>(
      `select
        (select count(*)::integer from challenge_evaluations) as evaluations,
        best_evaluation_id
      from challenge_attempts
      where id = $1`,
      [attemptId],
    );
    expect(result.rows[0]?.evaluations).toBe(1);
    expect(result.rows[0]?.best_evaluation_id).not.toBeNull();
  });

  test("Slow Service caps concurrent evaluations at five, stores source SHA and keeps the earliest tied best regardless of CPU", async () => {
    await client.query(
      "update challenge_attempts set challenge_slug = 'make-it-fast', queries_limit = 0, evaluations_limit = 5 where id = $1",
      [attemptId],
    );
    const reservations = (
      await Promise.all(
        Array.from({ length: 10 }, () =>
          reserveChallengeUse(attemptId, "evaluation", database),
        ),
      )
    ).filter((reservation) => reservation !== undefined);
    expect(reservations).toHaveLength(5);
    const first = reservations[0];
    const second = reservations[1];
    if (!first || !second) throw new Error("missing reservation");
    const source = "function createLedger() { return {}; }";
    const solution = {
      kind: "javascript_source",
      source,
      challengeSlug: "make-it-fast",
    } as const;
    await completeEvaluationReservation(
      first,
      solution,
      {
        challengeSlug: "make-it-fast",
        accuracy: 0.9,
        exactCount: 90,
        sampleSize: 100,
        meanError: 10,
        queriesUsed: 0,
        runtimeMs: 100,
      },
      database,
    );
    await completeEvaluationReservation(
      second,
      solution,
      {
        challengeSlug: "make-it-fast",
        accuracy: 0.9,
        exactCount: 90,
        sampleSize: 100,
        meanError: 10,
        queriesUsed: 0,
        runtimeMs: 1,
      },
      database,
    );
    const result = await client.query<{
      runtime_ms: number;
      source_digest: string;
      challenge_slug: string;
    }>(
      `select evaluation.runtime_ms, evaluation.solution->>'sourceDigest' as source_digest, evaluation.solution->>'challengeSlug' as challenge_slug from challenge_attempts as attempt join challenge_evaluations as evaluation on evaluation.id = attempt.best_evaluation_id where attempt.id = $1`,
      [attemptId],
    );
    expect(result.rows[0]).toEqual({
      runtime_ms: 100,
      source_digest: createHash("sha256").update(source).digest("hex"),
      challenge_slug: "make-it-fast",
    });
  });

  test("charges a reviewed Slow Service submission once across concurrent completions", async () => {
    await client.query(
      "update challenge_attempts set challenge_slug = 'make-it-fast', evaluations_limit = 5 where id = $1",
      [attemptId],
    );
    const first = await reserveChallengeUse(attemptId, "evaluation", database);
    const second = await reserveChallengeUse(attemptId, "evaluation", database);
    if (!first || !second) throw new Error("missing reservation");
    const solution = {
      kind: "javascript_source",
      challengeSlug: "make-it-fast",
      source: "function createLedger() { return {}; }",
      review: {
        sourceDigest: createHash("sha256")
          .update("function createLedger() { return {}; }")
          .digest("hex"),
        focus: "cpu_growth",
        decision: "ship",
        confidence: 80,
        failureScenario: "Repeated amendments can consume excessive CPU.",
        evidence: "The participant reviewed this exact code.",
        remainingRisk:
          "Production workloads may contain more rejected amendments.",
      },
    } as const;
    const score = {
      accuracy: 1,
      exactCount: 100,
      sampleSize: 100,
      meanError: 0,
      queriesUsed: 0,
      runtimeMs: 100,
    };
    const firstSubmission = { ...solution, approvalId: crypto.randomUUID() };
    const secondSubmission = { ...solution, approvalId: crypto.randomUUID() };
    const completed = await Promise.all([
      completeEvaluationReservation(first, firstSubmission, score, database),
      completeEvaluationReservation(second, secondSubmission, score, database),
    ]);
    expect(completed.map((result) => result?.evaluationsUsed)).toEqual([1, 1]);
    expect(
      (
        await client.query(
          "select evaluations_used, evaluations_pending from challenge_attempts",
        )
      ).rows,
    ).toEqual([{ evaluations_used: 1, evaluations_pending: 0 }]);
    expect(
      (await client.query("select id from challenge_evaluations")).rows,
    ).toHaveLength(1);
    expect(
      (await client.query("select id from challenge_reservations")).rows,
    ).toHaveLength(0);

    const changed = await reserveChallengeUse(
      attemptId,
      "evaluation",
      database,
    );
    if (!changed) throw new Error("missing reservation");
    const next = await completeEvaluationReservation(
      changed,
      {
        ...solution,
        source: "function createLedger() { return { amended: true }; }",
      },
      score,
      database,
    );
    expect(next?.evaluationsUsed).toBe(2);
    expect(
      (await client.query("select id from challenge_evaluations")).rows,
    ).toHaveLength(2);
  });

  test("keeps the better evaluation when completions race", async () => {
    const better = await reserveChallengeUse(attemptId, "evaluation", database);
    const worse = await reserveChallengeUse(attemptId, "evaluation", database);
    if (!better || !worse) throw new Error("missing reservations");

    await Promise.all([
      completeEvaluationReservation(
        better,
        { kind: "javascript_source", source: "return 1" },
        {
          accuracy: 1,
          exactCount: 1_000,
          sampleSize: 1_000,
          meanError: 0,
          queriesUsed: 10,
          runtimeMs: 5,
        },
        database,
      ),
      completeEvaluationReservation(
        worse,
        { kind: "javascript_source", source: "return 0" },
        {
          accuracy: 0.5,
          exactCount: 500,
          sampleSize: 1_000,
          meanError: 10,
          queriesUsed: 5,
          runtimeMs: 1,
        },
        database,
      ),
    ]);

    const result = await client.query<{ accuracy: number }>(
      `select evaluation.accuracy
      from challenge_attempts as attempt
      join challenge_evaluations as evaluation
        on evaluation.id = attempt.best_evaluation_id
      where attempt.id = $1`,
      [attemptId],
    );
    expect(result.rows[0]?.accuracy).toBe(1);
  });

  test("promotes an otherwise tied evaluation with a lower runtime", async () => {
    const first = await reserveChallengeUse(attemptId, "evaluation", database);
    if (!first) throw new Error("missing first reservation");
    await completeEvaluationReservation(
      first,
      { kind: "javascript_source", source: "return 1" },
      {
        accuracy: 1,
        exactCount: 1_000,
        sampleSize: 1_000,
        meanError: 0,
        queriesUsed: 10,
        runtimeMs: 100,
      },
      database,
    );

    const second = await reserveChallengeUse(attemptId, "evaluation", database);
    if (!second) throw new Error("missing second reservation");
    await completeEvaluationReservation(
      second,
      { kind: "javascript_source", source: "return 1" },
      {
        accuracy: 1,
        exactCount: 1_000,
        sampleSize: 1_000,
        meanError: 0,
        queriesUsed: 10,
        runtimeMs: 1,
      },
      database,
    );

    const result = await client.query<{ runtime_ms: number }>(
      `select evaluation.runtime_ms
      from challenge_attempts as attempt
      join challenge_evaluations as evaluation
        on evaluation.id = attempt.best_evaluation_id
      where attempt.id = $1`,
      [attemptId],
    );
    expect(result.rows[0]?.runtime_ms).toBe(1);
  });

  test("keeps the earlier Broken Agent evaluation when a later one only costs less", async () => {
    const first = await reserveChallengeUse(attemptId, "evaluation", database);
    if (!first) throw new Error("missing first reservation");
    await completeEvaluationReservation(
      first,
      { kind: "javascript_source", source: "return 1" },
      {
        accuracy: 1,
        exactCount: 100,
        sampleSize: 100,
        meanError: 0,
        queriesUsed: 0,
        runtimeMs: 0,
        executionCost: 900,
      },
      database,
    );

    const second = await reserveChallengeUse(attemptId, "evaluation", database);
    if (!second) throw new Error("missing second reservation");
    await completeEvaluationReservation(
      second,
      { kind: "javascript_source", source: "return 2" },
      {
        accuracy: 1,
        exactCount: 100,
        sampleSize: 100,
        meanError: 0,
        queriesUsed: 0,
        runtimeMs: 0,
        executionCost: 700,
      },
      database,
    );

    const result = await client.query<{ execution_cost: number }>(
      `select evaluation.execution_cost
      from challenge_attempts as attempt
      join challenge_evaluations as evaluation
        on evaluation.id = attempt.best_evaluation_id
      where attempt.id = $1`,
      [attemptId],
    );
    expect(result.rows[0]?.execution_cost).toBe(900);
  });
});
