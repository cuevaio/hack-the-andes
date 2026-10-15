import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import {
  TeamDashboardSchema,
  type TeamState,
  TeamStateSchema,
} from "@chofex/registration-contract";
import { PGlite } from "@electric-sql/pglite";
import { Schema } from "effect";

const db = new PGlite();
const migrations = new URL("../../../../packages/db/drizzle/", import.meta.url);
const person = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
beforeAll(async () => {
  for (const file of (await readdir(migrations))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(await readFile(new URL(file, migrations), "utf8"));
  }
});
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec(
    "truncate participants cascade; update hackathon_settings set selection_open=false",
  );
  // Teams have no owner; clear them explicitly after fixture cascade removals.
  await db.exec("truncate teams cascade");
});

async function seed(n: number, checkedIn = false) {
  await db.query(
    "insert into participants (id,clerk_user_id,name,legal_name) values ($1,$2,$3,$3)",
    [person(n), `user-${n}`, `Persona ${n}`],
  );
  const app = await db.query<{ id: string }>(
    "insert into applications (participant_id,status,participation_mode,picture_url) values ($1,'accepted','in_person','https://example.com/photo.png') returning id",
    [person(n)],
  );
  await db.query(
    "insert into acceptance_details (application_id,completed_at,date_of_birth,national_id_number,emergency_contact_name,emergency_contact_phone,checked_in_at,shirt_size) values ($1,now(),'2000-01-01','test','test','test',$2,'m')",
    [app.rows[0]?.id, checkedIn ? new Date() : null],
  );
}
async function action(
  n: number | null,
  command: unknown,
  admin: string | null = null,
) {
  const result = await db.query<{ result: Record<string, unknown> }>(
    "select hackathon_action($1::uuid,$2::jsonb,$3) as result",
    [n === null ? null : person(n), JSON.stringify(command), admin],
  );
  return result.rows[0]?.result as Record<string, unknown>;
}
async function state(n: number): Promise<TeamState> {
  const result = await db.query<{ result: unknown }>(
    "select hackathon_team_state($1::uuid) as result",
    [person(n)],
  );
  return Schema.decodeUnknownSync(TeamStateSchema)(result.rows[0]?.result);
}
async function create(n: number) {
  return Schema.decodeUnknownSync(TeamStateSchema)(
    await action(n, { action: "create", name: `Equipo ${n}` }),
  );
}
async function invite(from: number, to: number) {
  await action(from, { action: "invite", inviteeId: person(to) });
  return (await state(to)).invitations[0]?.id;
}
async function join(from: number, to: number) {
  const invitationId = await invite(from, to);
  return action(to, {
    action: "accept",
    invitationId,
    expectedTeamId: (await state(to)).team?.id ?? null,
  });
}
async function select(n: number, track = "environmental") {
  return action(n, {
    action: "track",
    track,
    expectedTeamId: (await state(n)).team?.id,
  });
}
async function open() {
  await action(null, { action: "settings", selectionOpen: true }, "admin");
}
function error(result: Record<string, unknown>) {
  return (result.error as { code: string } | undefined)?.code;
}

test("solo teams are valid, selection defaults closed, and dashboard uses shared schemas", async () => {
  await seed(1, true);
  const created = await create(1);
  expect(created.team?.members).toHaveLength(1);
  expect(created.selectionOpen).toBe(false);
  expect(error(await select(1))).toBe("TRACK_SELECTION_CLOSED");
  await open();
  expect(error(await select(1))).toBeUndefined();
  const result = await db.query<{ result: unknown }>(
    "select hackathon_team_dashboard() as result",
  );
  const dashboard = Schema.decodeUnknownSync(TeamDashboardSchema)(
    result.rows[0]?.result,
  );
  expect(dashboard.teams[0]?.track).toBe("environmental");
  expect(dashboard.teams[0]?.trackChangedBy).toBe("Persona 1");
});

test("unconfirmed/rejected participants cannot form teams", async () => {
  await seed(1);
  await db.exec("update acceptance_details set completed_at=null");
  expect(error(await action(1, { action: "create", name: "Equipo" }))).toBe(
    "CONFIRMATION_REQUIRED",
  );
  await db.exec("update applications set status='rejected'");
  expect(error(await action(1, { action: "checkin", tokenHash: "hash" }))).toBe(
    "CONFIRMATION_REQUIRED",
  );
});

test("legacy completed markers cannot bypass missing required confirmation details", async () => {
  await seed(1);
  await db.exec("update acceptance_details set shirt_size=null");
  expect(error(await action(1, { action: "create", name: "Equipo" }))).toBe(
    "CONFIRMATION_REQUIRED",
  );
  await db.exec(
    "update acceptance_details set shirt_size='m'; update participants set legal_name=null",
  );
  expect(error(await action(1, { action: "checkin", tokenHash: "hash" }))).toBe(
    "CONFIRMATION_REQUIRED",
  );
});

test("database cascades also delete a team when its final participant account is deleted", async () => {
  await seed(1);
  await seed(2);
  await create(1);
  await invite(1, 2);
  await db.query("delete from participants where id=$1", [person(1)]);
  expect((await db.query("select * from teams")).rows).toHaveLength(0);
  expect((await state(2)).invitations).toHaveLength(0);
});

test("invitation acceptance moves membership and deletes empty team, its invites and track slot", async () => {
  for (let n = 1; n <= 3; n++) await seed(n, true);
  const old = await create(1);
  await create(2);
  await invite(1, 3);
  await open();
  await select(1);
  const result = Schema.decodeUnknownSync(TeamStateSchema)(await join(2, 1));
  expect(result.team?.members).toHaveLength(2);
  expect(result.team?.id).not.toBe(old.team?.id);
  expect((await state(3)).invitations).toHaveLength(0);
  expect((await state(1)).tracks[0]?.teams).toBe(0);
  expect((await db.query("select * from teams")).rows).toHaveLength(1);
});

test("leaving the last membership immediately deletes the team", async () => {
  await seed(1);
  const created = await create(1);
  const result = Schema.decodeUnknownSync(TeamStateSchema)(
    await action(1, { action: "leave", expectedTeamId: created.team?.id }),
  );
  expect(result.team).toBeNull();
  expect((await db.query("select * from teams")).rows).toHaveLength(0);
});

test("invitations do not reserve membership; five-way acceptance cannot exceed four", async () => {
  for (let n = 1; n <= 6; n++) await seed(n);
  await create(1);
  const invitations = await Promise.all(
    [2, 3, 4, 5, 6].map(async (n) => ({ n, invitationId: await invite(1, n) })),
  );
  const results = await Promise.all(
    invitations.map(({ n, invitationId }) =>
      action(n, { action: "accept", invitationId, expectedTeamId: null }),
    ),
  );
  expect(results.filter((r) => error(r) === "TEAM_FULL")).toHaveLength(2);
  expect((await state(1)).team?.members).toHaveLength(4);
});

test("failed switch to a full team preserves original membership and invitation", async () => {
  for (let n = 1; n <= 5; n++) await seed(n);
  await create(1);
  const old = await create(5);
  const invitationId = await invite(1, 5);
  for (const n of [2, 3, 4]) await join(1, n);
  expect(
    error(
      await action(5, {
        action: "accept",
        invitationId,
        expectedTeamId: old.team?.id,
      }),
    ),
  ).toBe("TEAM_FULL");
  expect((await state(5)).team?.id).toBe(old.team?.id);
  expect((await state(5)).invitations).toHaveLength(1);
});

test("invitation is account-bound; decline does not affect current team", async () => {
  for (let n = 1; n <= 3; n++) await seed(n);
  await create(1);
  const old = await create(2);
  const invitationId = await invite(1, 2);
  expect(
    error(
      await action(3, { action: "accept", invitationId, expectedTeamId: null }),
    ),
  ).toBe("INVITATION_NOT_FOUND");
  await action(2, { action: "decline", invitationId });
  expect((await state(2)).team?.id).toBe(old.team?.id);
  expect((await state(2)).invitations).toHaveLength(0);
});

test("stale confirmation cannot move or remove someone from a newly joined team", async () => {
  for (let n = 1; n <= 3; n++) await seed(n, true);
  const old = await create(1);
  await create(2);
  await create(3);
  const invitationId = await invite(3, 1);
  await join(2, 1);
  expect(
    error(
      await action(1, {
        action: "accept",
        invitationId,
        expectedTeamId: old.team?.id,
      }),
    ),
  ).toBe("TEAM_CHANGED");
  expect(
    error(await action(1, { action: "leave", expectedTeamId: old.team?.id })),
  ).toBe("TEAM_CHANGED");
});

test("checked-in member can remove an absent creator, but not a checked-in peer", async () => {
  await seed(1);
  await seed(2, true);
  await create(1);
  await join(1, 2);
  const teamId = (await state(2)).team?.id;
  expect(error(await select(2))).toBe("TRACK_SELECTION_CLOSED");
  await open();
  expect(error(await select(2))).toBe("TEAM_CHECKIN_REQUIRED");
  expect(
    error(
      await action(1, {
        action: "remove",
        participantId: person(2),
        expectedTeamId: teamId,
      }),
    ),
  ).toBe("CHECKIN_REQUIRED");
  expect(
    error(
      await action(2, {
        action: "remove",
        participantId: person(1),
        expectedTeamId: teamId,
      }),
    ),
  ).toBeUndefined();
  expect((await state(1)).team).toBeNull();
  expect(error(await select(2))).toBeUndefined();
  expect((await state(2)).team?.members).toHaveLength(1);
});

test("check-in completed after a removal prompt prevents the removal", async () => {
  await seed(1, true);
  await seed(2);
  await create(1);
  await join(1, 2);
  const teamId = (await state(1)).team?.id;
  await action(2, { action: "checkin", tokenHash: "hash2" });
  await action(
    null,
    { action: "checkin-confirm", tokenHash: "hash2" },
    "admin",
  );
  expect(
    error(
      await action(1, {
        action: "remove",
        participantId: person(2),
        expectedTeamId: teamId,
      }),
    ),
  ).toBe("MEMBER_CHECKED_IN");
  expect((await state(1)).team?.members).toHaveLength(2);
});

test("unverified arrivals cannot join a tracked team even when selection is closed", async () => {
  await seed(1, true);
  await seed(2);
  await create(1);
  await create(2);
  await open();
  await select(1);
  await action(null, { action: "settings", selectionOpen: false }, "admin");
  expect(error(await join(1, 2))).toBe("CHECKIN_REQUIRED");
  expect((await state(2)).team?.name).toBe("Equipo 2");
});

test("track capacity is twelve, failed switch retains old slot, and leaving releases a slot", async () => {
  await open();
  for (let n = 1; n <= 14; n++) {
    await seed(n, true);
    await create(n);
  }
  const claims = await Promise.all(
    Array.from({ length: 13 }, (_, i) => select(i + 1)),
  );
  expect(claims.filter((r) => error(r) === "TRACK_FULL")).toHaveLength(1);
  await select(14, "security");
  expect(error(await select(14))).toBe("TRACK_FULL");
  expect((await state(14)).team?.track).toBe("security");
  const first = await state(1);
  await action(1, { action: "leave", expectedTeamId: first.team?.id });
  expect(error(await select(14))).toBeUndefined();
  expect((await state(14)).tracks.find((t) => t.id === "security")?.teams).toBe(
    0,
  );
});

test("any member can change track; manual closure prevents further changes", async () => {
  await seed(1, true);
  await seed(2, true);
  await create(1);
  await join(1, 2);
  await open();
  await select(1);
  await select(2, "transport");
  expect((await state(1)).team?.trackChangedBy).toBe("Persona 2");
  await action(null, { action: "settings", selectionOpen: false }, "admin");
  expect(error(await select(1, "security"))).toBe("TRACK_SELECTION_CLOSED");
});

test("there are at most 36 teams; last-member departure frees creation capacity", async () => {
  for (let n = 1; n <= 37; n++) await seed(n);
  for (let n = 1; n <= 36; n++) await create(n);
  expect(error(await action(37, { action: "create", name: "Extra" }))).toBe(
    "TEAMS_FULL",
  );
  await action(1, {
    action: "leave",
    expectedTeamId: (await state(1)).team?.id,
  });
  expect(
    error(await action(37, { action: "create", name: "Extra" })),
  ).toBeUndefined();
});

test("QR preview is read-only, confirmation requires admin, is idempotent and records attendance milestone", async () => {
  await seed(1);
  await db.exec(
    "insert into participant_badges (application_id,picture_url) select id,'https://example.com/confirmed.png' from applications",
  );
  const issued = await action(1, { action: "checkin", tokenHash: "hash1" });
  expect(issued.checkedIn).toBe(false);
  expect(
    error(
      await action(null, { action: "checkin-confirm", tokenHash: "hash1" }),
    ),
  ).toBe("ADMIN_REQUIRED");
  expect(
    error(await action(null, { action: "settings", selectionOpen: true })),
  ).toBe("ADMIN_REQUIRED");
  const preview = await action(
    null,
    { action: "checkin-preview", tokenHash: "hash1" },
    "admin",
  );
  expect(preview.checkedIn).toBe(false);
  expect(preview.pictureUrl).toBe("https://example.com/confirmed.png");
  expect((await state(1)).checkedIn).toBe(false);
  await action(
    null,
    { action: "checkin-confirm", tokenHash: "hash1" },
    "admin",
  );
  const before = await db.query("select checked_in_at from acceptance_details");
  await action(
    null,
    { action: "checkin-confirm", tokenHash: "hash1" },
    "another-admin",
  );
  expect(
    (await db.query("select checked_in_at from acceptance_details")).rows,
  ).toEqual(before.rows);
  expect(
    (await db.query("select confirmed_by from checkin_tokens")).rows[0],
  ).toEqual({ confirmed_by: "admin" });
  expect(
    (await action(1, { action: "checkin", tokenHash: "unused" })).checkedIn,
  ).toBe(true);
  expect(
    (
      await db.query(
        "select * from participant_funnel_milestones where stage='checked_in'",
      )
    ).rows,
  ).toHaveLength(1);
});

test("expired, rotated and no-longer-eligible QR codes cannot check someone in", async () => {
  await seed(1);
  await action(1, { action: "checkin", tokenHash: "old" });
  await action(1, { action: "checkin", tokenHash: "new" });
  expect(
    error(
      await action(
        null,
        { action: "checkin-confirm", tokenHash: "old" },
        "admin",
      ),
    ),
  ).toBe("CHECKIN_TOKEN_EXPIRED");
  await db.exec(
    "update checkin_tokens set expires_at=now()-interval '1 minute'",
  );
  expect(
    error(
      await action(
        null,
        { action: "checkin-confirm", tokenHash: "new" },
        "admin",
      ),
    ),
  ).toBe("CHECKIN_TOKEN_EXPIRED");
  await action(1, { action: "checkin", tokenHash: "fresh" });
  await db.exec("update applications set status='withdrawn'");
  expect(
    error(
      await action(
        null,
        { action: "checkin-confirm", tokenHash: "fresh" },
        "admin",
      ),
    ),
  ).toBe("CHECKIN_TOKEN_EXPIRED");
});
