import { playableChallenges } from "@chofex/challenges-contract";
import type { db } from "@chofex/db";
import { type SQL, sql } from "@chofex/db/orm";

import { currentChallengeVersionFor } from "./engine";

export interface ChallengeActivityCounts {
  readonly completed: number;
  readonly inProgress: number;
}

export type ChallengeMetricsDatabase = Pick<typeof db, "execute">;

interface ChallengeActivityCountsRow extends Record<string, unknown> {
  readonly completed: number;
  readonly in_progress: number;
}

const metricsDatabase = async (
  database: ChallengeMetricsDatabase | undefined,
): Promise<ChallengeMetricsDatabase> => {
  if (database) return database;
  return (await import("@chofex/db")).db;
};

const currentPlayableChallengeCondition = (
  slugColumn: SQL,
  versionColumn: SQL,
): SQL | undefined => {
  const conditions = playableChallenges.flatMap((challenge) => {
    const version = currentChallengeVersionFor(challenge.slug);
    if (!version) return [];
    return [
      sql`(${slugColumn} = ${challenge.slug} and ${versionColumn} = ${version})`,
    ];
  });
  if (conditions.length === 0) return undefined;
  return sql`(${sql.join(conditions, sql.raw(" or "))})`;
};

export const completedChallengeParticipantCondition = (
  participantId: SQL,
): SQL => {
  const challengeCondition = currentPlayableChallengeCondition(
    sql`"completed_challenge_attempt"."challenge_slug"`,
    sql`"completed_challenge_attempt"."challenge_version"`,
  );
  if (!challengeCondition) return sql`false`;

  return sql<boolean>`exists (
    select 1
    from "challenge_attempts" as "completed_challenge_attempt"
    inner join "challenge_evaluations" as "completed_challenge_evaluation"
      on "completed_challenge_evaluation"."attempt_id" = "completed_challenge_attempt"."id"
    where "completed_challenge_attempt"."participant_id" = ${participantId}
      and ${challengeCondition}
  )`;
};

export const startedChallengeParticipantCondition = (
  participantId: SQL,
): SQL => {
  const challengeCondition = currentPlayableChallengeCondition(
    sql`"started_challenge_attempt"."challenge_slug"`,
    sql`"started_challenge_attempt"."challenge_version"`,
  );
  if (!challengeCondition) return sql`false`;

  return sql<boolean>`exists (
    select 1
    from "challenge_attempts" as "started_challenge_attempt"
    where "started_challenge_attempt"."participant_id" = ${participantId}
      and ${challengeCondition}
  )`;
};

export const challengeActivityCounts = async (
  database?: ChallengeMetricsDatabase,
): Promise<ChallengeActivityCounts> => {
  const challengeCondition = currentPlayableChallengeCondition(
    sql`attempt."challenge_slug"`,
    sql`attempt."challenge_version"`,
  );
  if (!challengeCondition) return { completed: 0, inProgress: 0 };
  const client = await metricsDatabase(database);
  const result = await client.execute<ChallengeActivityCountsRow>(sql`
    select
      count(*) filter (
        where exists (
          select 1
          from "challenge_evaluations" as evaluation
          where evaluation."attempt_id" = attempt."id"
        )
      )::integer as "completed",
      count(*) filter (
        where
          not exists (
            select 1
            from "challenge_evaluations" as evaluation
            where evaluation."attempt_id" = attempt."id"
          )
      )::integer as "in_progress"
    from "challenge_attempts" as attempt
    where
      ${challengeCondition}
      and exists (
        select 1
        from "applications" as application
        where application."participant_id" = attempt."participant_id"
      )
  `);
  const row = result.rows[0];
  return {
    completed: row?.completed ?? 0,
    inProgress: row?.in_progress ?? 0,
  };
};
