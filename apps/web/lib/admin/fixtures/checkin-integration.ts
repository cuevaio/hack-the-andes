import { mock } from "bun:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/pglite";
import { HttpError } from "@/lib/registration/http";
import { createCheckinFixture } from "./checkin-database";

const fixture = await createCheckinFixture();
const { client } = fixture;
mock.module("@chofex/db", () => ({ db: drizzle(client) }));
let admin: string | null = null;
mock.module("@/lib/admin/auth", () => ({
  requireAdminIdentity: async () => {
    if (!admin)
      throw new HttpError(
        403,
        "ADMIN_REQUIRED",
        "Administrator access required",
      );
    return { clerkUserId: admin };
  },
}));
const route = await import("@/app/api/admin/checkin/route");
const { issueCheckin, adminCheckin } = await import("@/lib/teams/service");
async function call(method: "GET" | "POST" | "PATCH", input?: unknown) {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (input !== undefined) init.body = JSON.stringify(input);
  const response = await route[method](
    new Request("https://event.test/api/admin/checkin", init),
  );
  return { status: response.status, body: await response.json() };
}

try {
  for (const method of ["GET", "POST", "PATCH"] as const)
    assert.equal(
      (await call(method, method === "GET" ? undefined : {})).status,
      403,
    );
  admin = "admin-one";
  const ana = (
    await fixture.seed({
      name: "Ana",
      legalName: "Ana María Pérez",
      document: "12345678",
      confirmed: true,
    })
  ).applicationId;
  const jose = (
    await fixture.seed({
      name: "Pepe",
      legalName: "José García",
      document: "87654321",
      confirmed: true,
    })
  ).applicationId;
  const incomplete = (
    await fixture.seed({
      name: "Luis",
      legalName: "",
      document: null,
      confirmed: false,
    })
  ).applicationId;
  await fixture.seed({
    name: "Rechazado",
    legalName: "Persona Rechazada",
    document: "44444444",
    confirmed: true,
    status: "rejected",
  });
  const roster = await call("GET");
  assert.equal(roster.status, 200);
  assert.deepEqual(roster.body.data.counts, {
    total: 3,
    checkedIn: 0,
    pending: 3,
    confirmationRequired: 1,
  });
  assert.equal(
    roster.body.data.participants.find(
      (person: { applicationId: string }) => person.applicationId === ana,
    ).document.lastFour,
    "5678",
  );
  assert(!JSON.stringify(roster.body).includes("12345678"));
  assert(!JSON.stringify(roster.body).includes("v1:"));
  for (const search of [
    "12345678",
    "12-345 678",
    "ana@example.com",
    "ANA MARIA PEREZ",
  ]) {
    const found = await call("POST", { search });
    assert.equal(found.status, 200);
    assert.deepEqual(
      found.body.data.participants.map(
        (person: { applicationId: string }) => person.applicationId,
      ),
      [ana],
    );
  }
  assert.equal(
    (await call("POST", { search: "jose garcia" })).body.data.participants[0]
      .applicationId,
    jose,
  );
  assert.equal(
    (await call("PATCH", { applicationId: incomplete })).body.error.code,
    "CHECKIN_ELIGIBILITY_CHANGED",
  );
  assert.equal(
    (await call("PATCH", { applicationId: "not-an-id" })).status,
    422,
  );
  const qr = await issueCheckin("person-1");
  if (!("token" in qr) || typeof qr.token !== "string")
    throw new Error("Missing fixture QR");
  const first = await call("PATCH", { applicationId: ana });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.applicationId, ana);
  assert(Number.isFinite(Date.parse(first.body.data.checkedInAt)));
  admin = "admin-two";
  assert.deepEqual(
    (await call("PATCH", { applicationId: ana })).body.data,
    first.body.data,
  );
  assert.equal(
    (await adminCheckin("admin-two", qr.token, true)).checkedIn,
    true,
  );
  const audit = await client.query(
    "select d.checked_in_by,t.confirmed_by from acceptance_details d join checkin_tokens t on t.application_id=d.application_id where d.application_id=$1",
    [ana],
  );
  assert.deepEqual(audit.rows, [
    { checked_in_by: "admin-one", confirmed_by: "admin-one" },
  ]);
  const joseQr = await issueCheckin("person-2");
  if (!("token" in joseQr) || typeof joseQr.token !== "string")
    throw new Error("Missing fixture QR");
  assert.equal(
    (await adminCheckin("admin-two", joseQr.token, false)).checkedIn,
    false,
  );
  assert.equal(
    (await adminCheckin("admin-two", joseQr.token, true)).checkedIn,
    true,
  );
  assert.equal(
    (
      await client.query<{ checked_in_by: string }>(
        "select checked_in_by from acceptance_details where application_id=$1",
        [jose],
      )
    ).rows[0]?.checked_in_by,
    "admin-two",
  );
  const now = await call("GET");
  assert.deepEqual(now.body.data.counts, {
    total: 3,
    checkedIn: 2,
    pending: 1,
    confirmationRequired: 1,
  });
  const milestone = await client.query(
    "select m.reached_at=d.checked_in_at as same_time from participant_funnel_milestones m join applications a on a.participant_id=m.participant_id join acceptance_details d on d.application_id=a.id where a.id=$1 and m.stage='checked_in'",
    [ana],
  );
  assert.deepEqual(milestone.rows, [{ same_time: true }]);
  await client.query("update applications set status='withdrawn' where id=$1", [
    jose,
  ]);
  assert.equal(
    (await call("PATCH", { applicationId: jose })).body.error.code,
    "CHECKIN_ELIGIBILITY_CHANGED",
  );
  assert.equal((await call("GET")).body.data.counts.total, 2);
  console.log("admin check-in integration passed");
} finally {
  await client.close();
}
