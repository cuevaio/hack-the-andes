import { createHash } from "node:crypto";
import type {
  ChallengeObservation,
  ChallengeScore,
  ChallengeSlug,
  ChallengeSolution,
} from "@chofex/challenges-contract";
import type { db } from "@chofex/db";
import { sql } from "@chofex/db/orm";

export type ReservationDatabase = Pick<typeof db, "execute">;

const reservationDatabase = async (
  database: ReservationDatabase | undefined,
): Promise<ReservationDatabase> => {
  if (database) return database;
  return (await import("@chofex/db")).db;
};

export type ChallengeReservationKind = "query" | "evaluation";

export interface ChallengeReservation {
  readonly id: string;
  readonly attemptId: string;
  readonly shareCode: string;
  readonly queriesUsed: number;
  readonly queriesLimit: number;
  readonly evaluationsUsed: number;
  readonly evaluationsLimit: number;
}

interface ReservationRow extends Record<string, unknown> {
  readonly reservation_id: string;
  readonly attempt_id: string;
  readonly share_code: string;
  readonly queries_used: number;
  readonly queries_limit: number;
  readonly evaluations_used: number;
  readonly evaluations_limit: number;
}

export interface CompletedQuery {
  readonly observation: ChallengeObservation;
  readonly queriesUsed: number;
  readonly queriesLimit: number;
}

interface CompletedQueryRow extends Record<string, unknown> {
  readonly sequence: number;
  readonly input: unknown;
  readonly output: unknown;
  readonly created_at: Date | string;
  readonly queries_used: number;
  readonly queries_limit: number;
}

interface ExistingObservationRow extends Record<string, unknown> {
  readonly sequence: number;
  readonly input: unknown;
  readonly output: unknown;
  readonly created_at: Date | string;
}

export interface CompletedEvaluation {
  readonly shareCode: string;
  readonly evaluationsUsed: number;
  readonly evaluationsLimit: number;
}

interface CompletedEvaluationRow extends Record<string, unknown> {
  readonly share_code: string;
  readonly evaluations_used: number;
  readonly evaluations_limit: number;
}

const reservationLifetimeMs = 5 * 60 * 1_000;

export const findChallengeObservation = async (
  attemptId: string,
  input: unknown,
  database?: ReservationDatabase,
): Promise<ChallengeObservation | undefined> => {
  const client = await reservationDatabase(database);
  const result = await client.execute<ExistingObservationRow>(sql`
    select "sequence", "input", "output", "created_at"
    from "challenge_observations"
    where
      "attempt_id" = ${attemptId}
      and "input" = ${JSON.stringify(input)}::jsonb
    limit 1
  `);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    sequence: row.sequence,
    input: row.input,
    output: row.output,
    createdAt: new Date(row.created_at).toISOString(),
  };
};

export const reserveChallengeUse = async (
  attemptId: string,
  kind: ChallengeReservationKind,
  database?: ReservationDatabase,
  lifetimeMs = reservationLifetimeMs,
): Promise<ChallengeReservation | undefined> => {
  const client = await reservationDatabase(database);
  const reservationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + lifetimeMs);
  const result = await client.execute<ReservationRow>(sql`
    with expired as (
      delete from "challenge_reservations"
      where
        "attempt_id" = ${attemptId}
        and "expires_at" <= now()
      returning "kind"
    ), reserved as (
      update "challenge_attempts"
      set
        "queries_pending" = greatest(
          "queries_pending" - (
            select count(*)::integer from expired where "kind" = 'query'
          ),
          0
        ) + case when ${kind} = 'query' then 1 else 0 end,
        "evaluations_pending" = greatest(
          "evaluations_pending" - (
            select count(*)::integer from expired where "kind" = 'evaluation'
          ),
          0
        ) + case when ${kind} = 'evaluation' then 1 else 0 end,
        "updated_at" = now()
      where
        "id" = ${attemptId}
        and (
          (
            ${kind} = 'query'
            and "queries_used" + greatest(
              "queries_pending" - (
                select count(*)::integer from expired where "kind" = 'query'
              ),
              0
            ) < "queries_limit"
          )
          or (
            ${kind} = 'evaluation'
            and "evaluations_used" + greatest(
              "evaluations_pending" - (
                select count(*)::integer from expired where "kind" = 'evaluation'
              ),
              0
            ) < "evaluations_limit"
          )
        )
      returning
        "id",
        "share_code",
        "queries_used",
        "queries_limit",
        "evaluations_used",
        "evaluations_limit"
    ), created as (
      insert into "challenge_reservations" (
        "id",
        "attempt_id",
        "kind",
        "expires_at"
      )
      select ${reservationId}, "id", ${kind}, ${expiresAt}
      from reserved
      returning "id"
    )
    select
      created."id" as "reservation_id",
      reserved."id" as "attempt_id",
      reserved."share_code",
      reserved."queries_used",
      reserved."queries_limit",
      reserved."evaluations_used",
      reserved."evaluations_limit"
    from reserved
    cross join created
  `);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.reservation_id,
    attemptId: row.attempt_id,
    shareCode: row.share_code,
    queriesUsed: row.queries_used,
    queriesLimit: row.queries_limit,
    evaluationsUsed: row.evaluations_used,
    evaluationsLimit: row.evaluations_limit,
  };
};

export const releaseChallengeReservation = async (
  reservation: ChallengeReservation,
  kind: ChallengeReservationKind,
  database?: ReservationDatabase,
): Promise<void> => {
  const client = await reservationDatabase(database);
  await client.execute(sql`
    with released as (
      delete from "challenge_reservations"
      where
        "id" = ${reservation.id}
        and "attempt_id" = ${reservation.attemptId}
        and "kind" = ${kind}
      returning "attempt_id", "kind"
    )
    update "challenge_attempts" as attempt
    set
      "queries_pending" = greatest(
        attempt."queries_pending" - case when released."kind" = 'query' then 1 else 0 end,
        0
      ),
      "evaluations_pending" = greatest(
        attempt."evaluations_pending" - case when released."kind" = 'evaluation' then 1 else 0 end,
        0
      ),
      "updated_at" = now()
    from released
    where attempt."id" = released."attempt_id"
  `);
};

export const completeQueryReservation = async (
  reservation: ChallengeReservation,
  input: unknown,
  output: number,
  database?: ReservationDatabase,
): Promise<CompletedQuery | undefined> => {
  const client = await reservationDatabase(database);
  const result = await client.execute<CompletedQueryRow>(sql`
    with completed as (
      delete from "challenge_reservations"
      where
        "id" = ${reservation.id}
        and "attempt_id" = ${reservation.attemptId}
        and "kind" = 'query'
      returning "attempt_id"
    ), updated as (
      update "challenge_attempts" as attempt
      set
        "queries_pending" = greatest(attempt."queries_pending" - 1, 0),
        "queries_used" = attempt."queries_used" + 1,
        "updated_at" = now()
      from completed
      where attempt."id" = completed."attempt_id"
      returning
        attempt."id",
        attempt."query_sequence",
        attempt."queries_used",
        attempt."queries_limit"
    ), observation as (
      insert into "challenge_observations" (
        "attempt_id",
        "sequence",
        "input",
        "output"
      )
      select
        updated."id",
        updated."query_sequence",
        ${JSON.stringify(input)}::jsonb,
        to_jsonb(${output}::double precision)
      from updated
      returning "sequence", "input", "output", "created_at"
    )
    select
      observation."sequence",
      observation."input",
      observation."output",
      observation."created_at",
      updated."queries_used",
      updated."queries_limit"
    from observation
    cross join updated
  `);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    observation: {
      sequence: row.sequence,
      input: row.input,
      output: row.output,
      createdAt: new Date(row.created_at).toISOString(),
    },
    queriesUsed: row.queries_used,
    queriesLimit: row.queries_limit,
  };
};

export const consumeFailedEvaluationReservation = async (
  reservation: ChallengeReservation,
  database?: ReservationDatabase,
): Promise<CompletedEvaluation | undefined> => {
  const client = await reservationDatabase(database);
  const result = await client.execute<CompletedEvaluationRow>(sql`
    with completed as (
      delete from "challenge_reservations"
      where
        "id" = ${reservation.id}
        and "attempt_id" = ${reservation.attemptId}
        and "kind" = 'evaluation'
      returning "attempt_id"
    )
    update "challenge_attempts" as attempt
    set
      "evaluations_pending" = greatest(attempt."evaluations_pending" - 1, 0),
      "evaluations_used" = attempt."evaluations_used" + 1,
      "updated_at" = now()
    from completed
    where attempt."id" = completed."attempt_id"
    returning
      attempt."share_code",
      attempt."evaluations_used",
      attempt."evaluations_limit"
  `);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    shareCode: row.share_code,
    evaluationsUsed: row.evaluations_used,
    evaluationsLimit: row.evaluations_limit,
  };
};

export const completeEvaluationReservation = async (
  reservation: ChallengeReservation,
  solution: ChallengeSolution & { readonly challengeSlug?: ChallengeSlug },
  score: ChallengeScore,
  database?: ReservationDatabase,
): Promise<CompletedEvaluation | undefined> => {
  const client = await reservationDatabase(database);
  let storedSolution: Record<string, unknown> = { ...solution };
  if (solution.challengeSlug === "make-it-fast")
    storedSolution = {
      ...storedSolution,
      sourceDigest: createHash("sha256").update(solution.source).digest("hex"),
    };
  if (score.breakdown) {
    storedSolution = { ...storedSolution, scoreBreakdown: score.breakdown };
  }
  const result = await client.execute<CompletedEvaluationRow>(sql`
    select *
    from "complete_challenge_evaluation"(
      ${reservation.id},
      ${reservation.attemptId},
      ${solution.kind},
      ${JSON.stringify(storedSolution)}::jsonb,
      ${score.accuracy},
      ${score.exactCount},
      ${score.sampleSize},
      ${score.meanError},
      ${score.queriesUsed},
      ${score.runtimeMs},
      ${score.executionCost ?? null}
    )
  `);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    shareCode: row.share_code,
    evaluationsUsed: row.evaluations_used,
    evaluationsLimit: row.evaluations_limit,
  };
};
