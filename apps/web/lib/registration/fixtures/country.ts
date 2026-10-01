import { mock } from "bun:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { HttpError } from "../http";

const client = new PGlite();
const migrations = new URL(
  "../../../../../packages/db/drizzle/",
  import.meta.url,
);
const files = (await readdir(migrations))
  .filter((file) => file.endsWith(".sql"))
  .sort();
for (const file of files.filter((file) => file < "0025_")) {
  await client.exec(await readFile(new URL(file, migrations), "utf8"));
}
await client.exec(`
  insert into participants (id, clerk_user_id) values
    ('00000000-0000-4000-8000-000000000001', 'legacy-pe'),
    ('00000000-0000-4000-8000-000000000002', 'legacy-co');
  insert into applications (participant_id, country_code) values
    ('00000000-0000-4000-8000-000000000001', 'PE'),
    ('00000000-0000-4000-8000-000000000002', 'CO');
`);
const countryMigration = await readFile(
  new URL("0025_volatile_butterfly.sql", migrations),
  "utf8",
);
const prepareCountry = countryMigration
  .split("--> statement-breakpoint")
  .slice(0, 2)
  .join("\n");
await client.exec(prepareCountry);
await client.exec(prepareCountry);
assert.deepEqual(
  (
    await client.query(
      "select country_code from participants order by clerk_user_id",
    )
  ).rows,
  [{ country_code: "CO" }, { country_code: null }],
);
await client.exec(
  "update participants set country_code = 'AR' where clerk_user_id = 'legacy-co'",
);
await client.exec(countryMigration);
for (const file of files.filter(
  (file) => file > "0025_volatile_butterfly.sql",
)) {
  await client.exec(await readFile(new URL(file, migrations), "utf8"));
}
assert.deepEqual(
  (
    await client.query(
      "select country_code from participants where clerk_user_id = 'legacy-co'",
    )
  ).rows,
  [{ country_code: "AR" }],
);

mock.module("@chofex/db", () => ({ db: drizzle(client) }));
mock.module("../../challenges/service", () => ({
  challengeProgressForParticipant: async () => [],
}));
let admin = false;
mock.module("../../admin/auth", () => ({
  requireAdminIdentity: async () => {
    if (!admin) throw new HttpError(403, "ADMIN_REQUIRED", "Admin required");
    return { clerkUserId: "admin" };
  },
}));
const {
  saveRegistrationDraft,
  createRegistration,
  submitRegistration,
  getRegistration,
  selectRegistrationCountry,
} = await import("../service");
const { PATCH } = await import(
  "../../../app/api/admin/participants/[id]/country/route"
);
const { selectParticipantCountry, participantIdFor } = await import(
  "../participants"
);
const identity = {
  clerkUserId: "country-fixture",
  email: "country@example.com",
  name: "Country Test",
};
const first = await saveRegistrationDraft(identity, {
  fullName: "Country Test",
  role: "Builder",
  codeOfConductAccepted: true,
});
assert.equal(first.registration.countryCode, undefined);
await assert.rejects(submitRegistration(identity), {
  code: "APPLICATION_INCOMPLETE",
});
const submitted = await createRegistration(identity, {
  fullName: "Country Test",
  role: "Builder",
  countryCode: "CO",
  codeOfConductAccepted: true,
});
assert.equal(submitted.registration.status, "submitted");
assert.equal(submitted.registration.countryCode, "CO");
await assert.rejects(
  selectRegistrationCountry(identity.clerkUserId, { countryCode: "PE" }),
  { code: "COUNTRY_ALREADY_SET" },
);
await assert.rejects(
  selectRegistrationCountry(identity.clerkUserId, { countryCode: null }),
  { code: "VALIDATION_ERROR" },
);

const participantId = await participantIdFor(identity.clerkUserId);
const request = (countryCode: string) =>
  new Request("http://localhost/api/admin/participants/country", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ countryCode }),
  });
const context = { params: Promise.resolve({ id: participantId }) };
assert.equal((await PATCH(request("US"), context)).status, 403);
assert.equal(
  (await getRegistration(identity.clerkUserId)).registration.countryCode,
  "CO",
);
admin = true;
assert.equal((await PATCH(request("ZZ"), context)).status, 422);
assert.equal((await PATCH(request("US"), context)).status, 200);
assert.equal(
  (await getRegistration(identity.clerkUserId)).registration.countryCode,
  "US",
);
await assert.rejects(
  selectRegistrationCountry(identity.clerkUserId, { countryCode: "CO" }),
  { code: "COUNTRY_ALREADY_SET" },
);
await selectRegistrationCountry(identity.clerkUserId, { countryCode: "US" });

await client.query(
  "update applications set status = 'rejected' where id = $1",
  [submitted.registration.id],
);
await assert.rejects(saveRegistrationDraft(identity, { countryCode: "PE" }), {
  code: "COUNTRY_ALREADY_SET",
});
const next = await saveRegistrationDraft(identity, { role: "Engineer" });
assert.notEqual(next.registration.id, submitted.registration.id);
assert.equal(next.registration.countryCode, "US");
assert.equal((await PATCH(request("CL"), context)).status, 200);
assert.equal(
  (await saveRegistrationDraft(identity, { role: "Builder" })).registration
    .countryCode,
  "CL",
);

const raceId = await participantIdFor("country-race");
const race = await Promise.allSettled([
  selectParticipantCountry(raceId, "PE"),
  selectParticipantCountry(raceId, "CO"),
]);
assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
assert.equal(race.filter((result) => result.status === "rejected").length, 1);
for (const status of [
  "draft",
  "submitted",
  "under_review",
  "waitlisted",
  "accepted",
  "rejected",
  "withdrawn",
]) {
  await client.query("update applications set status = $1 where id = $2", [
    status,
    next.registration.id,
  ]);
  assert.equal((await PATCH(request("AR"), context)).status, 200);
}
await client.query(
  "update applications set status = 'accepted' where participant_id = $1",
  ["00000000-0000-4000-8000-000000000001"],
);
await selectRegistrationCountry("legacy-pe", { countryCode: "EC" });
assert.equal(
  (await getRegistration("legacy-pe")).registration.countryCode,
  "EC",
);
for (const adminFirst of [false, true]) {
  const id = await participantIdFor(`country-admin-race-${adminFirst}`);
  const adminWrite = () =>
    PATCH(request("BR"), { params: Promise.resolve({ id }) });
  const participantWrite = () => selectParticipantCountry(id, "PE");
  const writes = adminFirst
    ? [adminWrite, participantWrite]
    : [participantWrite, adminWrite];
  await Promise.allSettled(writes.map((write) => write()));
  assert.deepEqual(
    (
      await client.query(
        "select country_code from participants where id = $1",
        [id],
      )
    ).rows,
    [{ country_code: "BR" }],
  );
}
assert.equal(
  (
    await PATCH(request("PE"), {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000099" }),
    })
  ).status,
  404,
);
await client.close();
process.stdout.write("country lifecycle passed\n");
