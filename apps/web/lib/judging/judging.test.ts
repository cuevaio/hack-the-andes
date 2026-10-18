import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { Schema } from "effect";
import { AdminBoardSchema, JudgeBoardSchema, weightedScore } from "./contract";
import { hasJudgingRole, withJudgeRole } from "./roles";

const db = new PGlite();
const migrations = new URL("../../../../packages/db/drizzle/", import.meta.url);
beforeAll(async () => {
  for (const file of (await readdir(migrations))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(file, migrations), "utf8"));
}, 30000);
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec(
    "truncate judging_evaluations,judging_presentations,judging_judges; truncate participants,teams cascade; update judging_session set initialized_at=null,current_presentation_id=null,revision=0,remaining_ms=0,running_since=null",
  );
  await db.exec(
    "insert into judging_judges(clerk_user_id,name) values('judge-a','Ana'),('judge-b','Bruno')",
  );
  await db.exec(
    "insert into teams(id,name) values('00000000-0000-4000-8000-000000000001','Equipo Uno'),('00000000-0000-4000-8000-000000000002','Equipo Dos'); insert into project_submissions(team_id,deployment_url,presentation_url,description) select id,'https://example.com/demo','https://example.com/slides','Descripción original' from teams",
  );
});
async function admin(command: unknown) {
  return (
    await db.query<{ result: unknown }>(
      "select judging_admin_action('admin',$1::jsonb) as result",
      [JSON.stringify(command)],
    )
  ).rows[0]?.result;
}
async function board(actor: string | null = null) {
  return (
    await db.query<{ result: unknown }>(
      "select judging_review_board($1) as result",
      [actor],
    )
  ).rows[0]?.result;
}
async function save(
  presentationId: string,
  overrides: object = {},
  actor = "judge-a",
) {
  return (
    await db.query<{ result: unknown }>(
      "select judging_save_review($1,$2::jsonb) as result",
      [
        actor,
        JSON.stringify({
          presentationId,
          expectedRevision: 0,
          traction: 4,
          technical: 5,
          pitch: 3,
          notes: "Evidencia comprobada",
          submit: false,
          ...overrides,
        }),
      ],
    )
  ).rows[0]?.result;
}
async function initialize() {
  return Schema.decodeUnknownSync(AdminBoardSchema)(
    await admin({ action: "initialize", expectedRevision: 0 }),
  );
}
async function firstTwo(_data: typeof AdminBoardSchema.Type) {
  const { rows } = await db.query<{ id: string }>(
    "select id from judging_presentations order by position,id",
  );
  const [first, second] = rows;
  if (!first || !second) throw new Error("Missing fixture presentations");
  return [first, second] as const;
}

test("freezes submissions and admits only submitted projects", async () => {
  await db.exec("insert into teams(name) values('Sin entrega')");
  const data = await initialize();
  expect(data.presentations).toHaveLength(1);
  await db.exec(
    "update project_submissions set description='Edición posterior'; update teams set name='Renombrado'",
  );
  const frozen = Schema.decodeUnknownSync(AdminBoardSchema)(await board());
  expect(frozen.presentations[0]?.project.submission?.description).toBe(
    "Descripción original",
  );
  const { rows } = await db.query<{ count: number }>(
    "select count(*)::int as count from judging_presentations",
  );
  expect(rows[0]?.count).toBe(2);
  expect(frozen.presentations).toHaveLength(1);
});

test("stale admin cannot advance or reset a newer presentation", async () => {
  const data = await initialize();
  const [first, second] = await firstTwo(data);
  const current = Schema.decodeUnknownSync(AdminBoardSchema)(
    await admin({
      action: "present",
      presentationId: first.id,
      expectedRevision: 1,
    }),
  );
  expect(current.session.currentPresentationId).toBe(first.id);
  expect(
    await admin({
      action: "present",
      presentationId: second.id,
      expectedRevision: 1,
    }),
  ).toMatchObject({ error: { code: "SESSION_CHANGED" } });
  expect(
    Schema.decodeUnknownSync(AdminBoardSchema)(await board()).session
      .currentPresentationId,
  ).toBe(first.id);
});

test("late evaluation stays attached to the old team and remains in its judge history", async () => {
  const [first, second] = await firstTwo(await initialize());
  await admin({
    action: "present",
    presentationId: first.id,
    expectedRevision: 1,
  });
  await save(first.id);
  await admin({
    action: "present",
    presentationId: second.id,
    expectedRevision: 2,
  });
  const submitted = Schema.decodeUnknownSync(JudgeBoardSchema)(
    await save(first.id, { expectedRevision: 1, submit: true }),
  );
  expect(submitted.session.currentPresentationId).toBe(second.id);
  expect(submitted.presentations.map((p) => p.id)).toEqual([
    first.id,
    second.id,
  ]);
  expect(submitted.evaluations).toHaveLength(1);
  expect(submitted.evaluations[0]).toMatchObject({
    presentationId: first.id,
    traction: 4,
    technical: 5,
    pitch: 3,
  });
  const otherJudge = Schema.decodeUnknownSync(JudgeBoardSchema)(
    await board("judge-b"),
  );
  expect(otherJudge.presentations).toHaveLength(2);
  expect(otherJudge.evaluations).toHaveLength(0);
  const adminBoard = Schema.decodeUnknownSync(AdminBoardSchema)(await board());
  expect(adminBoard.evaluations[0]).toMatchObject({
    presentationId: first.id,
    judgeId: "judge-a",
    traction: 4,
    technical: 5,
    pitch: 3,
  });
  expect(
    adminBoard.evaluations.filter((e) => e.presentationId === second.id),
  ).toHaveLength(0);
  expect(
    weightedScore(
      adminBoard.evaluations[0] ?? {
        traction: null,
        technical: null,
        pitch: null,
        notes: "",
      },
    ),
  ).toBe(82);
});

test("drafts survive reload, prevent stale overwrites, and require explicit updates after submission", async () => {
  const [first] = await firstTwo(await initialize());
  expect(await save(first.id)).toMatchObject({
    error: { code: "NOT_PRESENTED" },
  });
  await admin({
    action: "present",
    presentationId: first.id,
    expectedRevision: 1,
  });
  await save(first.id, { technical: null });
  expect(
    Schema.decodeUnknownSync(JudgeBoardSchema)(await board("judge-a"))
      .evaluations[0],
  ).toMatchObject({ traction: 4, technical: null, revision: 1 });
  expect(await save(first.id, { traction: 1 })).toMatchObject({
    error: { code: "EVALUATION_CHANGED" },
  });
  expect(
    await save(first.id, {
      expectedRevision: 1,
      technical: null,
      submit: true,
    }),
  ).toMatchObject({ error: { code: "SCORES_REQUIRED" } });
  await save(first.id, { expectedRevision: 1, submit: true });
  expect(await save(first.id, { expectedRevision: 2 })).toMatchObject({
    error: { code: "SUBMITTED_UPDATE_REQUIRED" },
  });
  await admin({
    action: "reopen",
    presentationId: first.id,
    judgeId: "judge-a",
    expectedRevision: 2,
  });
  const reopened = Schema.decodeUnknownSync(JudgeBoardSchema)(
    await board("judge-a"),
  );
  expect(reopened.presentations.some((p) => p.id === first.id)).toBe(true);
  expect(reopened.evaluations[0]?.revision).toBe(3);
});

test("inactive judges and out-of-range scores cannot save", async () => {
  const [first] = await firstTwo(await initialize());
  await admin({
    action: "present",
    presentationId: first.id,
    expectedRevision: 1,
  });
  expect(await save(first.id, { traction: 6 })).toMatchObject({
    error: { code: "VALIDATION_ERROR" },
  });
  await db.exec(
    "update judging_judges set active=false where clerk_user_id='judge-a'",
  );
  expect(await save(first.id)).toMatchObject({
    error: { code: "JUDGE_REQUIRED" },
  });
});

test("timer uses server time, pauses, resumes, and never advances teams itself", async () => {
  const [first] = await firstTwo(await initialize());
  await admin({
    action: "present",
    presentationId: first.id,
    expectedRevision: 1,
  });
  await db.exec(
    "update judging_session set running_since=statement_timestamp()-interval '181 seconds'",
  );
  let data = Schema.decodeUnknownSync(AdminBoardSchema)(await board());
  expect(data.session.remainingMs).toBeLessThanOrEqual(119000);
  expect(data.session.remainingMs).toBeGreaterThan(118000);
  data = Schema.decodeUnknownSync(AdminBoardSchema)(
    await admin({ action: "pause", expectedRevision: 2 }),
  );
  expect(data.session.running).toBe(false);
  await admin({ action: "resume", expectedRevision: 3 });
  await db.exec(
    "update judging_session set running_since=statement_timestamp()-interval '10 minutes'",
  );
  data = Schema.decodeUnknownSync(AdminBoardSchema)(await board());
  expect(data.session.remainingMs).toBe(0);
  expect(data.session.currentPresentationId).toBe(first.id);
});

test("random queue hides future teams and rejects manual order changes", async () => {
  await db.exec(
    "insert into teams(name) values('Equipo Tres'),('Equipo Cuatro'); insert into project_submissions(team_id,deployment_url,presentation_url,description) select id,'https://example.com','https://example.com','Proyecto' from teams where name in ('Equipo Tres','Equipo Cuatro')",
  );
  const initial = await initialize();
  const [first, second] = await firstTwo(initial);
  expect(initial.remainingTeams).toBe(4);
  expect(
    Schema.decodeUnknownSync(JudgeBoardSchema)(await board("judge-a"))
      .remainingTeams,
  ).toBe(4);
  expect(initial.presentations.map((p) => p.id)).toEqual([first.id]);
  expect(
    Schema.decodeUnknownSync(JudgeBoardSchema)(await board("judge-a"))
      .presentations,
  ).toEqual([]);
  for (const action of ["reorder", "skip", "restore"]) {
    expect(
      await admin({
        action,
        presentationId: first.id,
        presentationIds: [second.id, first.id],
        expectedRevision: 1,
      }),
    ).toMatchObject({ error: { code: "RANDOM_ORDER" } });
  }
  expect(
    await admin({
      action: "present",
      presentationId: second.id,
      expectedRevision: 1,
    }),
  ).toMatchObject({ error: { code: "NEXT_TEAM_REQUIRED" } });
  await admin({
    action: "present",
    presentationId: first.id,
    expectedRevision: 1,
  });
  const afterFirst = Schema.decodeUnknownSync(AdminBoardSchema)(await board());
  expect(afterFirst.remainingTeams).toBe(3);
  expect(afterFirst.presentations.map((p) => p.id)).toEqual([
    first.id,
    second.id,
  ]);
  await admin({
    action: "present",
    presentationId: second.id,
    expectedRevision: 2,
  });
  const afterSecond = Schema.decodeUnknownSync(AdminBoardSchema)(await board());
  expect(afterSecond.presentations).toHaveLength(3);
  expect(
    afterSecond.presentations.filter((p) => p.status === "queued"),
  ).toHaveLength(1);
  const third = afterSecond.presentations.find((p) => p.status === "queued");
  if (!third) throw Error("Missing next team");
  await save(first.id, { submit: true });
  await admin({
    action: "present",
    presentationId: third.id,
    expectedRevision: 3,
  });
  const afterThird = Schema.decodeUnknownSync(AdminBoardSchema)(await board());
  expect(afterThird.presentations.some((p) => p.id === first.id)).toBe(false);
  expect(afterThird.evaluations).toEqual([]);
  expect(afterThird.presentations).toHaveLength(3);
  expect(afterThird.remainingTeams).toBe(1);
  await admin({ action: "finish", expectedRevision: 4 });
  const beforeLast = Schema.decodeUnknownSync(AdminBoardSchema)(await board());
  expect(beforeLast.remainingTeams).toBe(1);
  const last = beforeLast.presentations.find((p) => p.status === "queued");
  if (!last) throw Error("Missing final team");
  await admin({
    action: "present",
    presentationId: last.id,
    expectedRevision: 5,
  });
  expect(
    Schema.decodeUnknownSync(JudgeBoardSchema)(await board("judge-a"))
      .remainingTeams,
  ).toBe(0);
});

test("judge role preserves existing roles without granting admin access", () => {
  expect(
    withJudgeRole({ role: "application_reviewer", roles: ["participant"] }),
  ).toEqual(["application_reviewer", "participant", "judge"]);
  expect(hasJudgingRole({ roles: ["judge"] }, {}, "admin")).toBe(false);
  expect(hasJudgingRole({ roles: ["application_reviewer"] }, {}, "admin")).toBe(
    false,
  );
  expect(hasJudgingRole({}, { role: "admin" }, "admin")).toBe(true);
  expect(hasJudgingRole({ roles: ["judge"] }, {}, "judge")).toBe(true);
});

test("frozen roster uses public names and survives team deletion", async () => {
  await db.exec(
    "delete from project_submissions where team_id='00000000-0000-4000-8000-000000000002'",
  );
  await db.exec(
    "insert into participants(clerk_user_id,legal_name) values('unnamed','Private legal name'); insert into team_members(team_id,participant_id,slot) select '00000000-0000-4000-8000-000000000001',id,1 from participants where clerk_user_id='unnamed'",
  );
  const initialized = await initialize();
  const presentation = initialized.presentations.find(
    (item) => item.project.teamId === "00000000-0000-4000-8000-000000000001",
  );
  expect(presentation?.members).toEqual(["Participante"]);
  if (!presentation) throw new Error("Missing presentation");
  await admin({
    action: "present",
    presentationId: presentation.id,
    expectedRevision: 1,
  });
  await db.exec(
    "delete from teams where id='00000000-0000-4000-8000-000000000001'",
  );
  const afterDeletion = Schema.decodeUnknownSync(JudgeBoardSchema)(
    await save(presentation.id),
  );
  expect(
    afterDeletion.presentations.find((item) => item.id === presentation.id)
      ?.project.teamName,
  ).toBe("Equipo Uno");
});

test("judges can revise submitted scores for previous teams without changing other judges or the queue", async () => {
  const [first, second] = await firstTwo(await initialize());
  await admin({
    action: "present",
    presentationId: first.id,
    expectedRevision: 1,
  });
  await save(first.id, { submit: true });
  await save(
    first.id,
    { submit: true, traction: 2, technical: 2, pitch: 2 },
    "judge-b",
  );
  await admin({
    action: "present",
    presentationId: second.id,
    expectedRevision: 2,
  });
  expect(
    await save(first.id, {
      expectedRevision: 1,
      submit: true,
      technical: null,
    }),
  ).toMatchObject({ error: { code: "SCORES_REQUIRED" } });
  const updated = Schema.decodeUnknownSync(JudgeBoardSchema)(
    await save(first.id, {
      expectedRevision: 1,
      submit: true,
      traction: 5,
      technical: 4,
      pitch: 5,
      notes: "Puntajes revisados",
    }),
  );
  expect(updated.session.currentPresentationId).toBe(second.id);
  expect(updated.evaluations).toHaveLength(1);
  expect(updated.evaluations[0]).toMatchObject({
    judgeId: "judge-a",
    traction: 5,
    technical: 4,
    pitch: 5,
    notes: "Puntajes revisados",
    revision: 2,
  });
  expect(updated.evaluations[0]?.submittedAt).not.toBeNull();
  const reloaded = Schema.decodeUnknownSync(JudgeBoardSchema)(
    await board("judge-a"),
  );
  expect(reloaded.evaluations).toEqual(updated.evaluations);
  expect(reloaded.presentations.some((item) => item.id === first.id)).toBe(
    true,
  );
  expect(
    await save(first.id, { expectedRevision: 1, submit: true }),
  ).toMatchObject({ error: { code: "EVALUATION_CHANGED" } });
  const other = Schema.decodeUnknownSync(JudgeBoardSchema)(
    await board("judge-b"),
  );
  expect(other.evaluations).toHaveLength(1);
  expect(other.evaluations[0]).toMatchObject({
    judgeId: "judge-b",
    traction: 2,
    technical: 2,
    pitch: 2,
    revision: 1,
  });
});

test("existing judge clients keep their live board and submission contract", async () => {
  const [first] = await firstTwo(await initialize());
  await admin({
    action: "present",
    presentationId: first.id,
    expectedRevision: 1,
  });
  const command = {
    presentationId: first.id,
    expectedRevision: 0,
    traction: 4,
    technical: 5,
    pitch: 3,
    notes: "Original",
    submit: true,
  };
  const legacySubmit = await db.query<{ result: unknown }>(
    "select judging_save_evaluation('judge-a',$1::jsonb) as result",
    [JSON.stringify(command)],
  );
  const legacy = Schema.decodeUnknownSync(JudgeBoardSchema)(
    legacySubmit.rows[0]?.result,
  );
  expect(legacy.presentations).toEqual([]);
  expect(legacy.evaluations).toEqual([]);
  const history = Schema.decodeUnknownSync(JudgeBoardSchema)(
    await board("judge-a"),
  );
  expect(history.presentations.map((item) => item.id)).toEqual([first.id]);
  expect(history.evaluations[0]).toMatchObject({
    traction: 4,
    technical: 5,
    pitch: 3,
    revision: 1,
  });
  const legacyEdit = await db.query<{ result: unknown }>(
    "select judging_save_evaluation('judge-a',$1::jsonb) as result",
    [JSON.stringify({ ...command, expectedRevision: 1 })],
  );
  expect(legacyEdit.rows[0]?.result).toMatchObject({
    error: { code: "EVALUATION_LOCKED" },
  });
  const revised = Schema.decodeUnknownSync(JudgeBoardSchema)(
    await save(first.id, { expectedRevision: 1, traction: 5, submit: true }),
  );
  expect(revised.evaluations[0]).toMatchObject({ traction: 5, revision: 2 });
  const legacyPoll = await db.query<{ result: unknown }>(
    "select judging_board('judge-a') as result",
  );
  const polled = Schema.decodeUnknownSync(JudgeBoardSchema)(
    legacyPoll.rows[0]?.result,
  );
  expect(polled.presentations).toEqual([]);
  expect(polled.evaluations).toEqual([]);
});

test("all 26 teams remain reviewable and editable after the last presentation ends", async () => {
  await db.exec(
    "insert into teams(name) select 'Equipo adicional ' || n from generate_series(1,24) n; insert into project_submissions(team_id,deployment_url,presentation_url,description) select id,'https://example.com/demo','https://example.com/slides','Proyecto adicional' from teams where name like 'Equipo adicional %'",
  );
  await initialize();
  const { rows: teams } = await db.query<{ id: string }>(
    "select id from judging_presentations order by position,id",
  );
  expect(teams).toHaveLength(26);
  for (const [index, team] of teams.entries()) {
    await admin({
      action: "present",
      presentationId: team.id,
      expectedRevision: index + 1,
    });
    await save(team.id, { submit: true });
  }
  await admin({ action: "finish", expectedRevision: 27 });
  const finished = Schema.decodeUnknownSync(JudgeBoardSchema)(
    await board("judge-a"),
  );
  expect(finished.remainingTeams).toBe(0);
  expect(finished.session.currentPresentationId).toBeNull();
  expect(finished.presentations.map((item) => item.id)).toEqual(
    teams.map((team) => team.id),
  );
  expect(finished.evaluations).toHaveLength(26);
  for (const team of teams) {
    const revised = Schema.decodeUnknownSync(JudgeBoardSchema)(
      await save(team.id, {
        expectedRevision: 1,
        traction: 5,
        notes: "Revisado después del evento",
        submit: true,
      }),
    );
    expect(
      revised.evaluations.find((item) => item.presentationId === team.id),
    ).toMatchObject({
      traction: 5,
      revision: 2,
      notes: "Revisado después del evento",
    });
    expect(revised.session.currentPresentationId).toBeNull();
  }
  const reloaded = Schema.decodeUnknownSync(JudgeBoardSchema)(
    await board("judge-a"),
  );
  expect(reloaded.presentations).toHaveLength(26);
  expect(reloaded.evaluations).toHaveLength(26);
  expect(
    reloaded.evaluations.every(
      (item) =>
        item.revision === 2 && item.traction === 5 && item.submittedAt !== null,
    ),
  ).toBe(true);
});
