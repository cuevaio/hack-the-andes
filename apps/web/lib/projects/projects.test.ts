import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import {
  ProjectDashboardSchema,
  ProjectGallerySchema,
  ProjectStateSchema,
  ProjectUpdateReceiptSchema,
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
    "truncate participants cascade; update hackathon_settings set selection_open=false,gallery_visible=false,submissions_open=true",
  );
  // Teams have no owner; clear them explicitly after fixture cascade removals.
  await db.exec("truncate teams cascade; truncate project_archives");
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
async function project(
  n: number | null,
  command: unknown,
  admin: string | null = null,
) {
  const result = await db.query<{ result: unknown }>(
    "select hackathon_project_action($1::uuid,$2::jsonb,$3) as result",
    [n === null ? null : person(n), JSON.stringify(command), admin],
  );
  return result.rows[0]?.result;
}
async function gallery(admin = false) {
  const query = admin
    ? "select hackathon_project_dashboard() as result"
    : "select hackathon_project_gallery() as result";
  const result = await db.query<{ result: unknown }>(query);
  return Schema.decodeUnknownSync(ProjectGallerySchema)(result.rows[0]?.result);
}
test("any eligible member can publish, edit submission, rename; public visibility gates logs and submissions", async () => {
  await seed(1);
  await seed(2);
  const team = await create(1);
  await join(1, 2);
  const expectedTeamId = team.team?.id;
  const update = Schema.decodeUnknownSync(ProjectUpdateReceiptSchema)(
    await project(2, {
      action: "update",
      expectedTeamId,
      body: "## Decisión\nElegimos transporte",
    }),
  );
  expect(update.update.authorName).toBe("Persona 2");
  expect((await gallery()).projects).toEqual([]);
  expect((await gallery(true)).projects[0]?.updates).toHaveLength(1);
  const data = {
    action: "submit",
    expectedTeamId,
    expectedUpdatedAt: null,
    deploymentUrl: "https://demo.example.com",
    presentationUrl: "https://slides.example.com",
    githubUrl: "https://github.com/example/project",
    description: "# Proyecto",
  };
  for (const githubUrl of [
    undefined,
    "",
    "https://gitlab.com/example/project",
    "https://github.com/example",
    "https://github.com/example/project/issues",
  ]) {
    expect(await project(1, { ...data, githubUrl })).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  }
  const submitted = Schema.decodeUnknownSync(ProjectStateSchema)(
    await project(1, data),
  );
  const revised = Schema.decodeUnknownSync(ProjectStateSchema)(
    await project(2, {
      ...data,
      expectedUpdatedAt: submitted.project?.submission?.updatedAt,
      description: "# Proyecto revisado",
    }),
  );
  expect(revised.project?.submission?.submittedAt).toBe(
    submitted.project?.submission?.submittedAt,
  );
  expect(revised.project?.submission?.description).toBe("# Proyecto revisado");
  expect(revised.project?.submission?.githubUrl).toBe(
    "https://github.com/example/project",
  );
  await action(2, { action: "rename", expectedTeamId, name: "Nuevo equipo" });
  expect((await state(1)).team?.name).toBe("Nuevo equipo");
  await project(
    null,
    { action: "visibility", galleryVisible: true },
    "organizer",
  );
  expect((await gallery()).projects[0]?.teamName).toBe("Nuevo equipo");
  expect((await gallery()).projects[0]?.updates[0]?.body).toBe(
    "## Decisión\nElegimos transporte",
  );
  await project(
    null,
    { action: "visibility", galleryVisible: false },
    "organizer",
  );
  expect((await gallery()).projects).toEqual([]);
});
test("stale team, ineligible participant and incomplete submissions cannot write", async () => {
  await seed(1);
  const created = await create(1);
  const expectedTeamId = created.team?.id;
  const stale = await project(1, {
    action: "update",
    expectedTeamId: person(99),
    body: "No",
  });
  expect(stale).toMatchObject({ error: { code: "TEAM_CHANGED" } });
  expect(
    await project(1, {
      action: "submit",
      expectedTeamId,
      deploymentUrl: "javascript:alert(1)",
      presentationUrl: "https://example.com",
      githubUrl: "https://github.com/example/project",
      description: "x",
    }),
  ).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  expect(await project(1, { action: "submit", expectedTeamId })).toMatchObject({
    error: { code: "VALIDATION_ERROR" },
  });
  expect(
    await project(null, { action: "visibility", galleryVisible: true }),
  ).toMatchObject({ error: { code: "ADMIN_REQUIRED" } });
  await db.exec("update applications set status='withdrawn'");
  expect(
    await project(1, { action: "update", expectedTeamId, body: "No" }),
  ).toMatchObject({ error: { code: "CONFIRMATION_REQUIRED" } });
  expect((await gallery(true)).projects[0]?.updates).toEqual([]);
});
test("author departure preserves attributed logs; dissolved teams preserve their project privately for organizers", async () => {
  await seed(1);
  await seed(2);
  const team = await create(1);
  await join(1, 2);
  const expectedTeamId = team.team?.id;
  await project(1, {
    action: "update",
    expectedTeamId,
    body: "Decisión original",
  });
  await action(1, { action: "leave", expectedTeamId });
  await db.query("delete from participants where id=$1", [person(1)]);
  expect((await gallery(true)).projects[0]?.updates[0]?.authorName).toBe(
    "Persona 1",
  );
  await project(2, {
    action: "submit",
    expectedTeamId,
    expectedUpdatedAt: null,
    deploymentUrl: "https://demo.example.com",
    presentationUrl: "https://slides.example.com",
    githubUrl: "https://github.com/example/project",
    description: "Entrega conservada",
  });
  await action(2, { action: "leave", expectedTeamId });
  expect((await gallery(true)).projects).toEqual([]);
  const archived = await db.query<{ result: unknown }>(
    "select hackathon_project_dashboard() as result",
  );
  const dashboard = Schema.decodeUnknownSync(ProjectDashboardSchema)(
    archived.rows[0]?.result,
  );
  expect(dashboard.archives).toHaveLength(1);
  expect(dashboard.archives[0]?.project.teamName).toBe("Equipo 1");
  expect(dashboard.archives[0]?.project.updates[0]?.body).toBe(
    "Decisión original",
  );
  expect(dashboard.archives[0]?.project.updates[0]?.authorName).toBe(
    "Persona 1",
  );
  expect(dashboard.archives[0]?.project.submission?.description).toBe(
    "Entrega conservada",
  );
  await project(
    null,
    { action: "visibility", galleryVisible: true },
    "organizer",
  );
  expect((await gallery()).projects).toEqual([]);
});

test("competing initial submissions and stale revisions cannot overwrite the accepted version", async () => {
  await seed(1);
  await seed(2);
  const team = await create(1);
  await join(1, 2);
  const command = {
    action: "submit",
    expectedTeamId: team.team?.id,
    expectedUpdatedAt: null,
    deploymentUrl: "https://demo.example.com",
    presentationUrl: "https://slides.example.com",
    githubUrl: "https://github.com/example/project",
    description: "Primera entrega",
  };
  const results = await Promise.all([
    project(1, command),
    project(2, { ...command, description: "Otra entrega" }),
  ]);
  expect(
    results.filter((value) => Schema.is(ProjectStateSchema)(value)),
  ).toHaveLength(1);
  expect(
    results.filter((value) =>
      Schema.is(
        Schema.Struct({
          error: Schema.Struct({
            code: Schema.Literal("PROJECT_CHANGED"),
            message: Schema.String,
          }),
        }),
      )(value),
    ),
  ).toHaveLength(1);
  const current = (await gallery(true)).projects[0]?.submission;
  const updated = Schema.decodeUnknownSync(ProjectStateSchema)(
    await project(2, {
      ...command,
      expectedUpdatedAt: current?.updatedAt,
      description: "Nueva versión",
    }),
  );
  expect(updated.project?.submission?.description).toBe("Nueva versión");
  expect(
    await project(1, {
      ...command,
      expectedUpdatedAt: current?.updatedAt,
      description: "Obsoleta",
    }),
  ).toMatchObject({ error: { code: "PROJECT_CHANGED" } });
  expect((await gallery(true)).projects[0]?.submission?.description).toBe(
    "Nueva versión",
  );
});

test("joining another team archives the solo team's history and submission without transferring it", async () => {
  await seed(1);
  await seed(2);
  const source = await create(1);
  await create(2);
  const expectedTeamId = source.team?.id;
  await project(1, {
    action: "update",
    expectedTeamId,
    body: "Antes de unirnos",
  });
  await project(1, {
    action: "submit",
    expectedTeamId,
    expectedUpdatedAt: null,
    deploymentUrl: "https://demo.example.com",
    presentationUrl: "https://slides.example.com",
    githubUrl: "https://github.com/example/project",
    description: "Proyecto original",
  });
  const joined = Schema.decodeUnknownSync(TeamStateSchema)(await join(2, 1));
  expect(joined.team?.name).toBe("Equipo 2");
  const result = await db.query<{ result: unknown }>(
    "select hackathon_project_dashboard() as result",
  );
  const dashboard = Schema.decodeUnknownSync(ProjectDashboardSchema)(
    result.rows[0]?.result,
  );
  expect(dashboard.projects.map((entry) => entry.teamName)).toEqual([
    "Equipo 2",
  ]);
  expect(dashboard.projects[0]?.updates).toEqual([]);
  expect(dashboard.projects[0]?.submission).toBeNull();
  expect(dashboard.archives[0]?.project.teamName).toBe("Equipo 1");
  expect(dashboard.archives[0]?.project.updates[0]?.body).toBe(
    "Antes de unirnos",
  );
  expect(dashboard.archives[0]?.project.submission?.description).toBe(
    "Proyecto original",
  );
});

test("organizers close and reopen submissions, blocking new submissions and edits while preserving updates", async () => {
  await seed(1);
  const team = await create(1);
  const command = {
    action: "submit",
    expectedTeamId: team.team?.id,
    expectedUpdatedAt: null,
    deploymentUrl: "https://example.com/demo",
    presentationUrl: "https://example.com/slides",
    githubUrl: "https://github.com/example/project",
    description: "Entrega original",
  };
  expect(
    await project(null, { action: "submissions", submissionsOpen: false }),
  ).toMatchObject({ error: { code: "ADMIN_REQUIRED" } });
  const closed = await project(
    null,
    { action: "submissions", submissionsOpen: false },
    "admin",
  );
  expect(
    Schema.decodeUnknownSync(ProjectDashboardSchema)(closed).submissionsOpen,
  ).toBe(false);
  expect(await project(1, command)).toMatchObject({
    error: { code: "SUBMISSIONS_CLOSED" },
  });
  expect(
    await project(1, {
      action: "update",
      expectedTeamId: team.team?.id,
      body: "Seguimos trabajando",
    }),
  ).toMatchObject({ update: { body: "Seguimos trabajando" } });
  const opened = await project(
    null,
    { action: "submissions", submissionsOpen: true },
    "admin",
  );
  expect(
    Schema.decodeUnknownSync(ProjectDashboardSchema)(opened).submissionsOpen,
  ).toBe(true);
  const submitted = Schema.decodeUnknownSync(ProjectStateSchema)(
    await project(1, command),
  );
  expect(submitted.project?.submission?.description).toBe("Entrega original");
  await project(
    null,
    { action: "submissions", submissionsOpen: false },
    "admin",
  );
  expect(
    await project(1, {
      ...command,
      expectedUpdatedAt: submitted.project?.submission?.updatedAt,
      description: "Cambio bloqueado",
    }),
  ).toMatchObject({ error: { code: "SUBMISSIONS_CLOSED" } });
  await project(
    null,
    { action: "submissions", submissionsOpen: true },
    "admin",
  );
  const edited = Schema.decodeUnknownSync(ProjectStateSchema)(
    await project(1, {
      ...command,
      expectedUpdatedAt: submitted.project?.submission?.updatedAt,
      description: "Cambio permitido",
    }),
  );
  expect(edited.project?.submission?.description).toBe("Cambio permitido");
});
