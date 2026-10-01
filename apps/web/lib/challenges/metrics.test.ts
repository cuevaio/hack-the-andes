import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { playableChallenges } from "@chofex/challenges-contract";
import { sql } from "@chofex/db/orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { currentChallengeVersion } from "./engine";
import {
  type ChallengeMetricsDatabase,
  challengeActivityCounts,
  completedChallengeParticipantCondition,
  startedChallengeParticipantCondition,
} from "./metrics";

describe("challenge activity metrics", () => {
  let client: PGlite;
  let database: ChallengeMetricsDatabase;

  beforeEach(async () => {
    client = new PGlite();
    await client.exec(`
      create table challenge_attempts (
        id uuid primary key,
        participant_id uuid not null,
        challenge_slug varchar(64) not null,
        challenge_version varchar(64) not null,
        queries_used integer default 0 not null,
        evaluations_used integer default 0 not null
      );
      create table challenge_evaluations (
        id uuid primary key,
        attempt_id uuid not null references challenge_attempts(id)
      );
      create table applications (
        participant_id uuid primary key
      );
    `);
    database = drizzle(client) as unknown as ChallengeMetricsDatabase;
  });

  afterEach(async () => {
    await client.close();
  });

  test("counts only activity represented by participant challenge statuses", async () => {
    const playableSlug = playableChallenges[0]?.slug;
    if (!playableSlug) throw new Error("A playable challenge is required");

    const firstCompletedId = crypto.randomUUID();
    const secondCompletedId = crypto.randomUUID();
    const inProgressId = crypto.randomUUID();
    const hiddenCompletedId = crypto.randomUUID();
    await client.query(
      `insert into challenge_attempts (
        id,
        participant_id,
        challenge_slug,
        challenge_version,
        queries_used,
        evaluations_used
      ) values
        ($1, $1, $5, $6, 2, 1),
        ($2, $2, $5, $6, 2, 1),
        ($3, $3, $5, $6, 1, 0),
        ($4, $4, $5, $6, 2, 1)`,
      [
        firstCompletedId,
        secondCompletedId,
        inProgressId,
        hiddenCompletedId,
        playableSlug,
        currentChallengeVersion,
      ],
    );
    await client.query(
      `insert into applications (participant_id) values ($1), ($2), ($3)`,
      [firstCompletedId, secondCompletedId, inProgressId],
    );
    await client.query(
      `insert into challenge_evaluations (id, attempt_id) values
        (gen_random_uuid(), $1),
        (gen_random_uuid(), $2),
        (gen_random_uuid(), $3)`,
      [firstCompletedId, secondCompletedId, hiddenCompletedId],
    );

    await expect(challengeActivityCounts(database)).resolves.toEqual({
      completed: 2,
      inProgress: 1,
    });

    const completedParticipants = await database.execute<{
      participant_id: string;
    }>(sql`
      select application.participant_id
      from applications as application
      where ${completedChallengeParticipantCondition(
        sql`application.participant_id`,
      )}
      order by application.participant_id
    `);
    expect(completedParticipants.rows.map((row) => row.participant_id)).toEqual(
      [firstCompletedId, secondCompletedId].sort(),
    );

    const startedParticipants = await database.execute<{
      participant_id: string;
    }>(sql`
      select application.participant_id
      from applications as application
      where ${startedChallengeParticipantCondition(
        sql`application.participant_id`,
      )}
      order by application.participant_id
    `);
    expect(startedParticipants.rows.map((row) => row.participant_id)).toEqual(
      [firstCompletedId, secondCompletedId, inProgressId].sort(),
    );
  });

  test("counts public-test attempts without spent budget and excludes superseded versions", async () => {
    const currentId = "00000000-0000-0000-0000-000000000001";
    const historicalId = "00000000-0000-0000-0000-000000000002";
    await client.query(
      `insert into applications (participant_id) values ($1), ($2)`,
      [currentId, historicalId],
    );
    await client.query(
      `insert into challenge_attempts (id, participant_id, challenge_slug, challenge_version) values
      ($1, $1, 'broken-agent', 'broken-agent-v3'), ($2, $2, 'broken-agent', 'broken-agent-v2')`,
      [currentId, historicalId],
    );
    await expect(challengeActivityCounts(database)).resolves.toEqual({
      completed: 0,
      inProgress: 1,
    });
    const result = await database.execute<{ participant_id: string }>(sql`
      select application.participant_id from applications as application
      where ${startedChallengeParticipantCondition(sql`application.participant_id`)}
    `);
    expect(result.rows).toEqual([{ participant_id: currentId }]);
  });
});
