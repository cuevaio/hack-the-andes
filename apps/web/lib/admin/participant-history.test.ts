import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import type { Application } from "@chofex/db/schema";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { currentChallengeVersionFor } from "@/lib/challenges/engine";
import type { HistoryQuery } from "./history-query";
import {
  getParticipantHistory,
  type HistoryStage,
} from "./participant-history";

const query: HistoryQuery = {
  end: "2026-10-01",
  days: 7,
  now: "2026-10-01T12:00:00Z",
  showUpPercent: 100,
};
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const emptyStages = {
  registered: 0,
  draft: 0,
  submitted: 0,
  challenge_started: 0,
  challenge_completed: 0,
  accepted: 0,
  confirmed: 0,
  rejected: 0,
  withdrawn: 0,
  unknown: 0,
};
const emptyCurrent = {
  onSiteAccepted: 0,
  onSiteConfirmed: 0,
  onSiteAwaitingConfirmation: 0,
  remoteAccepted: 0,
  unknownModeAccepted: 0,
  recordedCheckIns: 0,
  reviewReady: 0,
  needsChallenge: 0,
  drafts: 0,
  firstConfirmationsLast7Days: 0,
  confirmationTimingUnknown: 0,
  missingDecisionDates: 0,
};

describe("participant history production SQL", () => {
  const client = new PGlite();
  const database = drizzle(client);
  beforeAll(async () => {
    const migrations = new URL(
      "../../../../packages/db/drizzle/",
      import.meta.url,
    );
    for (const file of (await readdir(migrations))
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      await client.exec(await readFile(new URL(file, migrations), "utf8"));
    }
  });
  afterAll(() => client.close());
  beforeEach(() => client.exec("truncate participants cascade"));

  async function person(
    n: number,
    country: string | null = "PE",
    created = "2026-09-25T05:00:00Z",
  ) {
    await client.query(
      "insert into participants (id, clerk_user_id, country_code, legal_name, created_at) values ($1, $2, $3, 'Private Legal Name', $4)",
      [id(n), `user-${n}`, country, created],
    );
  }
  async function application(
    n: number,
    participant = n,
    status: Application["status"] = "submitted",
    created = "2026-09-25T05:00:00Z",
    submitted: string | null = created,
    decided: string | null = null,
    mode: Application["participationMode"] = "in_person",
  ) {
    await client.query(
      "insert into applications (id, participant_id, status, created_at, submitted_at, decided_at, participation_mode, picture_url) values ($1,$2,$3,$4,$5,$6,$7,'https://example.test/private-picture')",
      [id(n), id(participant), status, created, submitted, decided, mode],
    );
  }
  async function details(
    n: number,
    completed: string | null = "2026-09-29T05:00:00Z",
    first: string | null = null,
  ) {
    await client.query(
      `insert into acceptance_details
      (application_id, date_of_birth, national_id_number, emergency_contact_name, emergency_contact_phone, shirt_size, completed_at, first_completed_at)
      values ($1,'1990-01-01','private-id','Private Emergency','private-phone','m',$2,$3)`,
      [id(n), completed, first],
    );
  }
  async function attempt(
    n: number,
    participant = n,
    created = "2026-09-28T05:00:00Z",
    version: string | undefined = currentChallengeVersionFor("black-box"),
  ) {
    await client.query(
      `insert into challenge_attempts
      (id, participant_id, challenge_slug, challenge_version, share_code, queries_limit, evaluations_limit, created_at)
      values ($1,$2,'black-box',$3,$4,10,10,$5)`,
      [id(n), id(participant), version, String(n).padStart(8, "0"), created],
    );
  }
  async function evaluation(
    n: number,
    attemptId: number,
    created = "2026-09-29T05:00:00Z",
    ranked = false,
  ) {
    await client.query(
      `insert into challenge_evaluations
      (id, attempt_id, solution_kind, solution, accuracy, exact_count, sample_size, mean_error, queries_used, runtime_ms, created_at)
      values ($1,$2,'code','{}',1,1,1,0,1,1,$3)`,
      [id(n), id(attemptId), created],
    );
    if (ranked)
      await client.query(
        "update challenge_attempts set best_evaluation_id = $1 where id = $2",
        [id(n), id(attemptId)],
      );
  }
  async function stages(
    expected: readonly Partial<Record<HistoryStage, number>>[],
    input = query,
  ) {
    const report = await getParticipantHistory(input, database);
    expect(report.days.map((day) => day.stages)).toEqual(
      expected.map((stage) => ({ ...emptyStages, ...stage })),
    );
    for (const day of report.days)
      expect(
        Object.values(day.stages).reduce((sum, count) => sum + count, 0),
      ).toBe(day.people);
    return report;
  }

  test("keeps zero days, no-application people, exclusive Lima midnights and a partial today", async () => {
    await person(1);
    await application(
      1,
      1,
      "submitted",
      "2026-09-26T05:00:00Z",
      "2026-09-27T05:00:00Z",
    );
    await attempt(1);
    await evaluation(1, 1);
    await evaluation(2, 1, "2026-09-30T00:00:00Z");
    const report = await stages(
      [
        {},
        { registered: 1 },
        { draft: 1 },
        { submitted: 1 },
        { challenge_started: 1 },
        { challenge_completed: 1 },
        { challenge_completed: 1 },
      ],
      { ...query, end: "2026-09-30" },
    );
    expect(
      report.days.map(({ date, partial, people }) => ({
        date,
        partial,
        people,
      })),
    ).toEqual([
      { date: "2026-09-24", partial: false, people: 0 },
      { date: "2026-09-25", partial: false, people: 1 },
      { date: "2026-09-26", partial: false, people: 1 },
      { date: "2026-09-27", partial: false, people: 1 },
      { date: "2026-09-28", partial: false, people: 1 },
      { date: "2026-09-29", partial: false, people: 1 },
      { date: "2026-09-30", partial: false, people: 1 },
    ]);
    expect(report.current).toEqual({ ...emptyCurrent, needsChallenge: 1 });
    const today = await getParticipantHistory(query, database);
    expect(today.days.at(-1)).toEqual({
      date: "2026-10-01",
      partial: true,
      people: 1,
      stages: { ...emptyStages, challenge_completed: 1 },
    });
  });

  test("selects the latest application at each cutoff, with ID ties and draft precedence", async () => {
    await person(1);
    await application(
      1,
      1,
      "rejected",
      undefined,
      undefined,
      "2026-09-28T05:00:00Z",
    );
    await attempt(1, 1, "2026-09-25T06:00:00Z");
    await evaluation(1, 1, "2026-09-25T07:00:00Z", true);
    await application(2, 1, "withdrawn", "2026-09-30T05:00:00Z", null);
    await application(3, 1, "draft", "2026-09-30T05:00:00Z", null);
    const report = await stages([
      { challenge_completed: 1 },
      { challenge_completed: 1 },
      { challenge_completed: 1 },
      { rejected: 1 },
      { rejected: 1 },
      { draft: 1 },
      { draft: 1 },
    ]);
    expect(report.current).toEqual({ ...emptyCurrent, drafts: 1 });
    await client.query(
      "update applications set status='submitted', submitted_at='2026-10-01T05:00:00Z' where id=$1",
      [id(3)],
    );
    const submitted = await getParticipantHistory(query, database);
    expect(submitted.days.at(-1)?.stages).toEqual({
      ...emptyStages,
      challenge_completed: 1,
    });
    expect(submitted.current).toEqual({ ...emptyCurrent, reviewReady: 1 });
  });

  test("keeps legacy confirmation intervals and undated terminal history unknown", async () => {
    for (const n of [1, 2, 3, 4, 5]) await person(n);
    await application(
      1,
      1,
      "accepted",
      undefined,
      undefined,
      "2026-09-26T05:00:00Z",
    );
    await application(
      2,
      2,
      "accepted",
      undefined,
      undefined,
      "2026-09-26T05:00:00Z",
    );
    await application(3, 3, "accepted");
    await application(4, 4, "rejected");
    await application(
      5,
      5,
      "withdrawn",
      undefined,
      undefined,
      "2026-09-26T05:00:00Z",
    );
    await details(1, undefined, "2026-09-29T05:00:00Z");
    await details(2);
    const report = await stages([
      { submitted: 2, unknown: 3 },
      { accepted: 1, unknown: 4 },
      { accepted: 1, unknown: 4 },
      { accepted: 1, unknown: 4 },
      { confirmed: 2, unknown: 3 },
      { confirmed: 2, unknown: 3 },
      { confirmed: 2, accepted: 1, rejected: 1, withdrawn: 1 },
    ]);
    expect(report.current).toEqual({
      ...emptyCurrent,
      onSiteAccepted: 3,
      onSiteConfirmed: 2,
      onSiteAwaitingConfirmation: 1,
      firstConfirmationsLast7Days: 1,
      confirmationTimingUnknown: 1,
      missingDecisionDates: 2,
    });
    await details(3);
    const inferred = await getParticipantHistory(query, database);
    expect(inferred.days[4]?.stages).toEqual({
      ...emptyStages,
      confirmed: 3,
      unknown: 2,
    });
  });

  test("rejects future records and evaluations; future decisions do not advance prior days", async () => {
    await person(1);
    await application(
      1,
      1,
      "accepted",
      undefined,
      undefined,
      "2026-10-02T05:00:00Z",
    );
    await attempt(1);
    await evaluation(1, 1, "2026-10-02T05:00:00Z", true);
    await details(1, "2026-10-02T06:00:00Z", "2026-10-02T06:00:00Z");
    await person(2, "PE", "2026-10-02T05:00:00Z");
    await person(3);
    await application(3, 3, "draft", "2026-10-02T05:00:00Z", null);
    await attempt(3, 3, "2026-10-02T05:00:00Z");
    const report = await stages([
      { submitted: 1, registered: 1 },
      { submitted: 1, registered: 1 },
      { submitted: 1, registered: 1 },
      { challenge_started: 1, registered: 1 },
      { challenge_started: 1, registered: 1 },
      { challenge_started: 1, registered: 1 },
      { challenge_started: 1, registered: 1 },
    ]);
    expect(report.current).toEqual(emptyCurrent);
  });

  test("uses current-country/current-version cohorts without filtering the live goal or earlier cohort days", async () => {
    await person(1, "CO");
    await application(
      1,
      1,
      "accepted",
      undefined,
      undefined,
      "2026-09-26T05:00:00Z",
    );
    await details(1, undefined, "2026-09-29T05:00:00Z");
    await attempt(1);
    await person(2, null);
    await application(2, 2, "submitted");
    await attempt(2, 2, undefined, "obsolete-version");
    await evaluation(2, 2, undefined, true);
    await person(3, "PE");
    await attempt(3, 3, "2026-10-02T05:00:00Z");
    const filtered = await stages(
      [
        { submitted: 1 },
        { accepted: 1 },
        { accepted: 1 },
        { accepted: 1 },
        { confirmed: 1 },
        { confirmed: 1 },
        { confirmed: 1 },
      ],
      {
        ...query,
        challenge: "black-box",
        country: { kind: "country", code: "CO" },
      },
    );
    expect(filtered.current).toEqual({
      ...emptyCurrent,
      onSiteAccepted: 1,
      onSiteConfirmed: 1,
      firstConfirmationsLast7Days: 1,
      needsChallenge: 1,
    });
    const oldDate = await getParticipantHistory(
      { ...query, end: "2026-09-24", country: { kind: "country", code: "AR" } },
      database,
    );
    expect(oldDate.current).toEqual({
      ...emptyCurrent,
      onSiteAccepted: 1,
      onSiteConfirmed: 1,
      firstConfirmationsLast7Days: 1,
      needsChallenge: 1,
    });
    expect(oldDate.days.map((day) => day.people)).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
    const unknown = await getParticipantHistory(
      { ...query, country: { kind: "unknown" } },
      database,
    );
    expect(unknown.days.at(-1)?.stages).toEqual({
      ...emptyStages,
      submitted: 1,
    });
    expect(JSON.stringify(filtered)).not.toContain("Private");
    expect(JSON.stringify(filtered)).not.toContain("private-id");
  });

  test("requires ranked evidence for the current review queue and counts modes separately", async () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) await person(n);
    await application(1, 1, "submitted");
    await attempt(1);
    await evaluation(1, 1, undefined, true);
    await application(2, 2, "under_review");
    await attempt(2);
    await evaluation(2, 2);
    await application(3, 3, "waitlisted");
    await attempt(3, 3, undefined, "obsolete-version");
    await evaluation(3, 3, undefined, true);
    await application(4, 4, "draft", undefined, null);
    await attempt(4);
    await evaluation(4, 4, undefined, true);
    await application(
      5,
      5,
      "accepted",
      undefined,
      undefined,
      undefined,
      "remote",
    );
    await details(5);
    await application(6, 6, "accepted", undefined, undefined, undefined, null);
    await details(6);
    await application(7, 7, "accepted");
    await details(7);
    await application(8, 8, "rejected");
    await details(8);
    await client.exec(
      "update acceptance_details set checked_in_at='2026-09-30T05:00:00Z'",
    );
    expect((await getParticipantHistory(query, database)).current).toEqual({
      ...emptyCurrent,
      onSiteAccepted: 1,
      onSiteConfirmed: 1,
      remoteAccepted: 1,
      unknownModeAccepted: 1,
      recordedCheckIns: 1,
      reviewReady: 1,
      needsChallenge: 2,
      drafts: 1,
      confirmationTimingUnknown: 1,
      missingDecisionDates: 4,
    });
  });

  test("counts only currently valid known-first confirmations in the preceding seven full Lima days", async () => {
    const times = [
      "2026-09-24T04:59:59.999Z",
      "2026-09-24T05:00:00Z",
      "2026-10-01T04:59:59.999Z",
      "2026-10-01T05:00:00Z",
      null,
    ];
    for (const [index, time] of times.entries()) {
      const n = index + 1;
      await person(n, "PE", "2026-09-20T05:00:00Z");
      await application(
        n,
        n,
        "accepted",
        "2026-09-20T05:00:00Z",
        undefined,
        "2026-09-21T05:00:00Z",
      );
      await details(n, time ?? "2026-09-30T05:00:00Z", time);
    }
    expect((await getParticipantHistory(query, database)).current).toEqual({
      ...emptyCurrent,
      onSiteAccepted: 5,
      onSiteConfirmed: 5,
      firstConfirmationsLast7Days: 2,
      confirmationTimingUnknown: 1,
    });
    await client.query("update applications set picture_url=null where id=$1", [
      id(2),
    ]);
    expect(
      (await getParticipantHistory({ ...query, end: "2026-09-24" }, database))
        .current,
    ).toEqual({
      ...emptyCurrent,
      onSiteAccepted: 5,
      onSiteConfirmed: 4,
      onSiteAwaitingConfirmation: 1,
      firstConfirmationsLast7Days: 1,
      confirmationTimingUnknown: 1,
    });
  });

  test("does not infer confirmation from pre-created details or submission from a missing date", async () => {
    await person(1);
    await application(
      1,
      1,
      "accepted",
      undefined,
      undefined,
      "2026-09-26T05:00:00Z",
    );
    await details(1, null);
    await person(2);
    await application(2, 2, "under_review", undefined, null);
    await stages([
      { submitted: 1, unknown: 1 },
      { accepted: 1, unknown: 1 },
      { accepted: 1, unknown: 1 },
      { accepted: 1, unknown: 1 },
      { accepted: 1, unknown: 1 },
      { accepted: 1, unknown: 1 },
      { accepted: 1, unknown: 1 },
    ]);
    expect((await getParticipantHistory(query, database)).current).toEqual({
      ...emptyCurrent,
      onSiteAccepted: 1,
      onSiteAwaitingConfirmation: 1,
      needsChallenge: 1,
    });
  });

  test.each([
    ["participants", "legal_name", null],
    ["participants", "legal_name", ""],
    ["acceptance_details", "date_of_birth", null],
    ["acceptance_details", "national_id_number", null],
    ["acceptance_details", "national_id_number", ""],
    ["acceptance_details", "emergency_contact_name", null],
    ["acceptance_details", "emergency_contact_name", ""],
    ["acceptance_details", "emergency_contact_phone", null],
    ["acceptance_details", "emergency_contact_phone", ""],
    ["applications", "picture_url", null],
    ["applications", "picture_url", ""],
    ["acceptance_details", "shirt_size", null],
    ["acceptance_details", "completed_at", null],
  ])(
    "requires canonical confirmation field %s.%s = %s independently",
    async (table, column, value) => {
      await person(1);
      await application(
        1,
        1,
        "accepted",
        undefined,
        undefined,
        "2026-09-26T05:00:00Z",
      );
      await details(1);
      expect((await getParticipantHistory(query, database)).current).toEqual({
        ...emptyCurrent,
        onSiteAccepted: 1,
        onSiteConfirmed: 1,
        confirmationTimingUnknown: 1,
      });
      await client.exec(
        "begin; alter table acceptance_details drop constraint acceptance_details_completed_fields_required",
      );
      try {
        await client.query(`update ${table} set ${column}=$1`, [value]);
        const report = await getParticipantHistory(query, database);
        expect(report.current).toEqual({
          ...emptyCurrent,
          onSiteAccepted: 1,
          onSiteAwaitingConfirmation: 1,
        });
        if (column !== "completed_at")
          expect(report.days[4]?.stages).toEqual({
            ...emptyStages,
            confirmed: 1,
          });
      } finally {
        await client.exec("rollback");
      }
    },
  );
});
