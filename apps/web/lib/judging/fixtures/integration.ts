import { mock } from "bun:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { ApiSuccessSchema } from "@chofex/registration-contract";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { Schema } from "effect";
import { AdminBoardSchema, JudgeBoardSchema } from "../contract";

mock.module("server-only", () => ({}));
const db = new PGlite();
const migrations = new URL(
  "../../../../../packages/db/drizzle/",
  import.meta.url,
);
for (const file of (await readdir(migrations))
  .filter((file) => file.endsWith(".sql"))
  .sort())
  await db.exec(await readFile(new URL(file, migrations), "utf8"));
mock.module("@chofex/db", () => ({ db: drizzle(db) }));
let signedIn: string | null = null;
const person = {
  id: "judge",
  firstName: "Ana",
  lastName: "Jurado",
  username: null,
  publicMetadata: {
    role: "participant",
    roles: ["participant"],
    custom: "preserved",
  },
  privateMetadata: {},
  emailAddresses: [
    { emailAddress: "ana@example.com", verification: { status: "verified" } },
  ],
};
mock.module("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: signedIn }),
  clerkClient: async () => ({
    users: {
      getUser: async (id: string) => {
        if (id === "admin")
          return { publicMetadata: { role: "admin" }, privateMetadata: {} };
        if (id === "reviewer")
          return {
            publicMetadata: { roles: ["application_reviewer"] },
            privateMetadata: {},
          };
        return person;
      },
      getUserList: async ({ emailAddress }: { emailAddress: string[] }) => ({
        data: emailAddress.includes("ana@example.com") ? [person] : [],
      }),
      updateUserMetadata: async (
        _id: string,
        update: { publicMetadata: { roles: string[] } },
      ) => {
        person.publicMetadata.roles = update.publicMetadata.roles;
      },
    },
  }),
}));
process.env.ADMIN_CLERK_USER_IDS = "";
const admin = await import("@/app/api/admin/judging/route");
const judges = await import("@/app/api/admin/judging/judges/route");
const judge = await import("@/app/api/judging/route");
const request = (path: string, method = "GET", body?: unknown) => {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request(`http://localhost${path}`, init);
};
assert.equal((await admin.GET(request("/api/admin/judging"))).status, 403);
signedIn = "reviewer";
assert.equal((await admin.GET(request("/api/admin/judging"))).status, 403);
signedIn = "judge";
assert.equal((await judge.GET(request("/api/judging"))).status, 403);
signedIn = "admin";
assert.equal(
  (
    await judges.POST(
      request("/api/admin/judging/judges", "POST", {
        email: "missing@example.com",
      }),
    )
  ).status,
  422,
);
const grant = await judges.POST(
  request("/api/admin/judging/judges", "POST", { email: "ana@example.com" }),
);
assert.equal(grant.status, 200);
assert.deepEqual(person.publicMetadata, {
  role: "participant",
  roles: ["participant", "judge"],
  custom: "preserved",
});
await db.exec(
  "insert into teams(name) values('Equipo de prueba'); insert into project_submissions(team_id,deployment_url,presentation_url,description) select id,'https://example.com','https://example.com/slides','Entrega' from teams",
);
const initialized = Schema.decodeUnknownSync(
  ApiSuccessSchema(AdminBoardSchema),
)(
  await (
    await admin.PATCH(
      request("/api/admin/judging", "PATCH", {
        action: "initialize",
        expectedRevision: 0,
      }),
    )
  ).json(),
).data;
const presentation = initialized.presentations[0];
assert.ok(presentation);
await admin.PATCH(
  request("/api/admin/judging", "PATCH", {
    action: "present",
    presentationId: presentation.id,
    expectedRevision: 1,
  }),
);
signedIn = "judge";
assert.equal(
  (
    await admin.PATCH(
      request("/api/admin/judging", "PATCH", {
        action: "finish",
        expectedRevision: 2,
      }),
    )
  ).status,
  403,
);
const visible = Schema.decodeUnknownSync(ApiSuccessSchema(JudgeBoardSchema))(
  await (await judge.GET(request("/api/judging"))).json(),
).data;
assert.equal(visible.session.currentPresentationId, presentation.id);
assert.equal(visible.presentations[0]?.project.teamName, "Equipo de prueba");
const invalid = await judge.PATCH(
  request("/api/judging", "PATCH", {
    presentationId: presentation.id,
    expectedRevision: 0,
    traction: 6,
    technical: 4,
    pitch: 3,
    notes: "",
    submit: true,
  }),
);
assert.equal(invalid.status, 422);
const submittedResponse = await judge.PATCH(
  request("/api/judging", "PATCH", {
    presentationId: presentation.id,
    expectedRevision: 0,
    traction: 4,
    technical: 5,
    pitch: 3,
    notes: "Buena evidencia",
    submit: true,
  }),
);
assert.equal(submittedResponse.status, 200);
const submitted = Schema.decodeUnknownSync(ApiSuccessSchema(JudgeBoardSchema))(
  await submittedResponse.json(),
).data;
assert.equal(submitted.presentations.length, 0);
assert.equal(submitted.evaluations.length, 0);
assert.equal("judges" in submitted, false);
signedIn = "admin";
await judges.PATCH(
  request("/api/admin/judging/judges", "PATCH", {
    clerkUserId: "judge",
    active: false,
  }),
);
signedIn = "judge";
assert.equal((await judge.GET(request("/api/judging"))).status, 403);
assert.equal(
  (
    await judge.PATCH(
      request("/api/judging", "PATCH", {
        presentationId: presentation.id,
        expectedRevision: 1,
        traction: 4,
        technical: 5,
        pitch: 3,
        notes: "",
        submit: false,
      }),
    )
  ).status,
  403,
);
await db.close();
console.log("judging integration passed");
