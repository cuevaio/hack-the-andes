import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const client = new PGlite();
const participant = "00000000-0000-4000-8000-000000000001";
const application = "00000000-0000-4000-8000-000000000002";
const secondApplication = "00000000-0000-4000-8000-000000000003";
const attempt = "00000000-0000-4000-8000-000000000004";
const migrations = new URL("../../../../packages/db/drizzle/", import.meta.url);
const milestoneFile = "0029_sweet_steel_serpent.sql";
let milestoneMigration = "";
let backfilledKnown: Record<string, string> = {};
const knownParticipant = "00000000-0000-4000-8000-000000000005";
let backfilled: Record<string, string> = {};
let afterLegacyEdit: Record<string, string> = {};

beforeAll(async () => {
  const files = (await readdir(migrations))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const migration = await readFile(new URL(file, migrations), "utf8");
    if (file === milestoneFile) {
      milestoneMigration = migration;
      break;
    }
    await client.exec(migration);
  }
  await client.query(
    "insert into participants (id,clerk_user_id,created_at) values ($1,'legacy','2026-09-16T18:00:00Z')",
    [participant],
  );
  await client.query(
    "insert into applications (id,participant_id,status,created_at,submitted_at,decided_at) values ($1,$2,'accepted','2026-09-17T18:00:00Z','2026-09-18T18:00:00Z','2026-09-19T18:00:00Z'), ($3,$2,'withdrawn','2026-09-16T19:00:00Z',null,null)",
    [application, participant, secondApplication],
  );
  await client.query(
    "insert into acceptance_details (application_id,completed_at,date_of_birth,national_id_number,emergency_contact_name,emergency_contact_phone) values ($1,'2026-09-20T18:00:00Z','2000-01-01','test','test','test')",
    [application],
  );
  await client.query(
    "insert into participants (id,clerk_user_id,created_at) values ($1,'known','2026-09-16T10:00:00Z')",
    [knownParticipant],
  );
  await client.query(
    "insert into applications (id,participant_id,status,created_at,submitted_at,decided_at) values ('00000000-0000-4000-8000-000000000006',$1,'accepted','2026-09-20T10:00:00Z','2026-09-20T11:00:00Z','2026-09-20T12:00:00Z'), ('00000000-0000-4000-8000-000000000007',$1,'rejected','2026-09-17T10:00:00Z','2026-09-18T10:00:00Z','2026-09-19T10:00:00Z')",
    [knownParticipant],
  );
  await client.exec(
    "insert into acceptance_details (application_id,completed_at,first_completed_at,checked_in_at,date_of_birth,national_id_number,emergency_contact_name,emergency_contact_phone) values ('00000000-0000-4000-8000-000000000006','2026-09-21T10:00:00Z','2026-09-21T10:00:00Z','2026-09-22T10:00:00Z','2000-01-01','test','test','test')",
  );
  await client.query(
    "insert into challenge_attempts (id,participant_id,challenge_slug,challenge_version,share_code,queries_limit,evaluations_limit,created_at) values ($1,$2,'black-box','v1','knownone',100,10,'2026-09-18T11:00:00Z'),($3,$2,'black-box','v2','knowntwo',100,10,'2026-09-20T11:00:00Z')",
    [attempt, knownParticipant, "00000000-0000-4000-8000-000000000008"],
  );
  await client.query(
    "insert into challenge_evaluations (attempt_id,solution_kind,solution,accuracy,exact_count,sample_size,mean_error,queries_used,runtime_ms,created_at) values ($1,'javascript','{}',1,1,1,0,0,1,'2026-09-19T11:00:00Z'),($1,'javascript','{}',1,1,1,0,0,1,'2026-09-20T11:00:00Z'),($2,'javascript','{}',1,1,1,0,0,1,'2026-09-21T11:00:00Z')",
    [attempt, "00000000-0000-4000-8000-000000000008"],
  );
  await client.exec(milestoneMigration);
  for (const file of files.filter((file) => file > milestoneFile)) {
    await client.exec(await readFile(new URL(file, migrations), "utf8"));
  }
  backfilled = await milestones();
  backfilledKnown = await milestones(knownParticipant);
  await client.exec(
    "update acceptance_details set completed_at='2026-09-22T18:00:00Z'; update applications set updated_at=now() where status='withdrawn'",
  );
  afterLegacyEdit = await milestones();
});
afterAll(() => client.close());

async function milestones(personId = participant) {
  const result = await client.query<{ stage: string; reached_at: Date }>(
    "select stage, reached_at from participant_funnel_milestones where participant_id=$1 order by stage",
    [personId],
  );
  return Object.fromEntries(
    result.rows.map((row) => [row.stage, row.reached_at.toISOString()]),
  );
}

beforeEach(() => client.exec("truncate participants cascade"));

async function signup() {
  await client.query(
    "insert into participants (id,clerk_user_id,created_at) values ($1,'new','2026-10-01T18:00:00Z')",
    [participant],
  );
  await client.query(
    "insert into applications (id,participant_id,created_at) values ($1,$2,'2026-10-01T19:00:00Z')",
    [application, participant],
  );
}

test("backfills earliest recorded milestones without dating unknown withdrawals or confirmations", async () => {
  expect(backfilled).toEqual({
    accepted: "2026-09-19T18:00:00.000Z",
    draft: "2026-09-16T19:00:00.000Z",
    registered: "2026-09-16T18:00:00.000Z",
    submitted: "2026-09-18T18:00:00.000Z",
  });
  expect(afterLegacyEdit).toEqual(backfilled);
});

test("records every application transition and retains first dates through retries and reapplication", async () => {
  await signup();
  await client.query(
    "update applications set status='submitted',submitted_at='2026-10-02T18:00:00Z' where id=$1",
    [application],
  );
  for (const status of [
    "under_review",
    "waitlisted",
    "accepted",
    "rejected",
    "withdrawn",
  ]) {
    const before = new Date();
    await client.query("update applications set status=$1 where id=$2", [
      status,
      application,
    ]);
    const reached = (await milestones())[status];
    expect(reached).toBeDefined();
    expect(Date.parse(reached ?? "")).toBeGreaterThanOrEqual(
      before.getTime() - 1,
    );
    expect(Date.parse(reached ?? "")).toBeLessThanOrEqual(Date.now());
  }
  const first = await milestones();
  await client.query(
    "update applications set status='withdrawn',updated_at=now() where id=$1",
    [application],
  );
  await client.query(
    "insert into applications (id,participant_id,status,created_at,submitted_at) values ($1,$2,'submitted','2026-10-03T18:00:00Z','2026-10-03T19:00:00Z')",
    [secondApplication, participant],
  );
  expect(await milestones()).toEqual(first);
  expect(first.registered).toBe("2026-10-01T18:00:00.000Z");
  expect(first.draft).toBe("2026-10-01T19:00:00.000Z");
  expect(first.submitted).toBe("2026-10-02T18:00:00.000Z");
});

test("records challenge start and earliest evaluation across challenge versions", async () => {
  await signup();
  await client.query(
    "insert into challenge_attempts (id,participant_id,challenge_slug,challenge_version,share_code,queries_limit,evaluations_limit,created_at) values ($1,$2,'black-box','historical','mileston',100,10,'2026-10-01T20:00:00Z')",
    [attempt, participant],
  );
  await client.query(
    "insert into challenge_evaluations (attempt_id,solution_kind,solution,accuracy,exact_count,sample_size,mean_error,queries_used,runtime_ms,created_at) values ($1,'javascript','{}',1,1,1,0,0,1,'2026-10-02T20:00:00Z'),($1,'javascript','{}',1,1,1,0,0,1,'2026-10-03T20:00:00Z')",
    [attempt],
  );
  expect(await milestones()).toMatchObject({
    challenge_started: "2026-10-01T20:00:00.000Z",
    challenge_completed: "2026-10-02T20:00:00.000Z",
  });
});

test("records first confirmation and check-in without moving them on later edits", async () => {
  await signup();
  await client.query(
    "insert into acceptance_details (application_id,completed_at,first_completed_at,date_of_birth,national_id_number,emergency_contact_name,emergency_contact_phone) values ($1,'2026-10-02T18:00:00Z','2026-10-02T18:00:00Z','2000-01-01','test','test','test')",
    [application],
  );
  await client.query(
    "update acceptance_details set completed_at='2026-10-03T18:00:00Z',checked_in_at='2026-10-03T19:00:00Z' where application_id=$1",
    [application],
  );
  expect(await milestones()).toMatchObject({
    confirmed: "2026-10-02T18:00:00.000Z",
    checked_in: "2026-10-03T19:00:00.000Z",
  });
});

test("captures a new completion atomically even if a caller omits first_completed_at", async () => {
  await signup();
  await client.query(
    "insert into acceptance_details (application_id) values ($1)",
    [application],
  );
  await client.query(
    "update acceptance_details set completed_at='2026-10-02T18:00:00Z',date_of_birth='2000-01-01',national_id_number='test',emergency_contact_name='test',emergency_contact_phone='test' where application_id=$1",
    [application],
  );
  expect(await milestones()).toMatchObject({
    confirmed: "2026-10-02T18:00:00.000Z",
  });
  await client.exec(
    "begin; update applications set status='withdrawn'; rollback;",
  );
  expect(await milestones()).not.toHaveProperty("withdrawn");
});

test("records a newly inserted completion even without a separate first date", async () => {
  await signup();
  await client.query(
    "insert into acceptance_details (application_id,completed_at,date_of_birth,national_id_number,emergency_contact_name,emergency_contact_phone) values ($1,'2026-10-02T18:00:00Z','2000-01-01','test','test','test')",
    [application],
  );
  expect(await milestones()).toMatchObject({
    confirmed: "2026-10-02T18:00:00.000Z",
  });
});

test("backfills every available stage using the earliest dated attempt or application", () => {
  expect(backfilledKnown).toEqual({
    accepted: "2026-09-20T12:00:00.000Z",
    challenge_completed: "2026-09-19T11:00:00.000Z",
    challenge_started: "2026-09-18T11:00:00.000Z",
    checked_in: "2026-09-22T10:00:00.000Z",
    confirmed: "2026-09-21T10:00:00.000Z",
    draft: "2026-09-17T10:00:00.000Z",
    registered: "2026-09-16T10:00:00.000Z",
    rejected: "2026-09-19T10:00:00.000Z",
    submitted: "2026-09-18T10:00:00.000Z",
  });
});

test("uses the explicit decision date when status and decided_at change together", async () => {
  await signup();
  await client.query(
    "update applications set status='accepted',decided_at='2026-10-02T19:00:00Z' where id=$1",
    [application],
  );
  expect(await milestones()).toMatchObject({
    accepted: "2026-10-02T19:00:00.000Z",
  });
});

test("dates newly inserted terminal states by their observation time, not a backdated creation", async () => {
  for (const status of [
    "accepted",
    "rejected",
    "under_review",
    "waitlisted",
    "withdrawn",
  ]) {
    await client.exec("truncate participants cascade");
    await signup();
    await client.query("delete from applications where id=$1", [application]);
    const before = Date.now();
    await client.query(
      "insert into applications (id,participant_id,status,created_at) values ($1,$2,$3,'2026-09-01T10:00:00Z')",
      [application, participant, status],
    );
    const reached = (await milestones())[status];
    expect(Date.parse(reached ?? "")).toBeGreaterThanOrEqual(before - 1);
    expect(Date.parse(reached ?? "")).toBeLessThanOrEqual(Date.now());
  }
});

test("replaying the backfill preserves earlier trigger-created timestamps", async () => {
  await signup();
  await client.query(
    "update applications set status='accepted',decided_at='2026-10-02T19:00:00Z' where id=$1",
    [application],
  );
  const first = await milestones();
  await client.query(
    "update applications set decided_at='2026-10-03T19:00:00Z' where id=$1",
    [application],
  );
  const backfillSql = milestoneMigration.slice(
    milestoneMigration.lastIndexOf("INSERT INTO participant_funnel_milestones"),
  );
  await client.exec(backfillSql);
  await client.exec(backfillSql);
  expect(await milestones()).toEqual(first);
});
