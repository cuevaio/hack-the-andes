import { mock } from "bun:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/pglite";
import { createCheckinFixture } from "@/lib/admin/fixtures/checkin-database";

const fixture = await createCheckinFixture();
const { client } = fixture;
mock.module("@chofex/db", () => ({ db: drizzle(client) }));
let clerkUserId = "unknown";
mock.module("@/lib/auth", () => ({
  requireAuthenticatedParticipant: async () => ({ clerkUserId }),
}));
const { GET } = await import("@/app/api/v1/credits/route");
const credits = () => GET(new Request("https://event.test/api/v1/credits"));
try {
  const person = await fixture.seed({
    name: "Presente",
    legalName: "",
    document: null,
    confirmed: false,
  });
  clerkUserId = person.clerkUserId;
  await client.query<Record<string, unknown>>(
    "update acceptance_details set date_of_birth=null,emergency_contact_name=null,emergency_contact_phone=null,shirt_size=null where application_id=$1",
    [person.applicationId],
  );
  assert.equal((await credits()).status, 403);
  for (const [admin, reason] of [
    ["", "Llegada verificada"],
    ["admin-one", " "],
  ]) {
    await assert.rejects(
      client.query<Record<string, unknown>>(
        "select hackathon_confirm_arrival_exception($1::uuid,$2,$3)",
        [person.applicationId, admin, reason],
      ),
    );
  }
  await client.query<Record<string, unknown>>(
    "select hackathon_confirm_arrival_exception($1::uuid,$2,$3)",
    [person.applicationId, "admin-one", "Llegada verificada por organización"],
  );
  const before = (
    await client.query<Record<string, unknown>>(
      "select checked_in_at,checked_in_by,checkin_exception_reason,completed_at,date_of_birth,national_id_number,emergency_contact_name,emergency_contact_phone from acceptance_details where application_id=$1",
      [person.applicationId],
    )
  ).rows[0];
  assert.equal(before?.checked_in_by, "admin-one");
  assert.equal(
    before?.checkin_exception_reason,
    "Llegada verificada por organización",
  );
  for (const field of [
    "completed_at",
    "date_of_birth",
    "national_id_number",
    "emergency_contact_name",
    "emergency_contact_phone",
  ])
    assert.equal(before?.[field], null);
  await client.query<Record<string, unknown>>(
    "select hackathon_confirm_arrival_exception($1::uuid,$2,$3)",
    [person.applicationId, "admin-two", "Segundo intento"],
  );
  const after = (
    await client.query<Record<string, unknown>>(
      "select checked_in_at,checked_in_by,checkin_exception_reason,completed_at,date_of_birth,national_id_number,emergency_contact_name,emergency_contact_phone from acceptance_details where application_id=$1",
      [person.applicationId],
    )
  ).rows[0];
  assert.deepEqual(after, before);
  const response = await credits();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.credits.length, 10);
  assert.equal(
    (
      await client.query<Record<string, unknown>>(
        "select count(*)::int as count from hackathon_confirmed_participants where participant_id=$1",
        [person.participantId],
      )
    ).rows[0]?.count,
    0,
  );
  await client.query<Record<string, unknown>>(
    "update applications set status='withdrawn' where id=$1",
    [person.applicationId],
  );
  assert.equal((await credits()).status, 403);
  await assert.rejects(
    client.query<Record<string, unknown>>(
      "select hackathon_confirm_arrival_exception($1::uuid,$2,$3)",
      [person.applicationId, "admin-one", "No aceptada"],
    ),
  );
  const normal = await fixture.seed({
    name: "Confirmada",
    legalName: "Confirmada",
    document: "12345678",
    confirmed: true,
  });
  clerkUserId = normal.clerkUserId;
  assert.equal((await credits()).status, 403);
  await client.query<Record<string, unknown>>(
    "select hackathon_confirm_arrival($1::uuid,$2)",
    [normal.applicationId, "admin-one"],
  );
  assert.equal((await credits()).status, 200);
  console.log("organizer check-in exception passed");
} finally {
  await client.close();
}
