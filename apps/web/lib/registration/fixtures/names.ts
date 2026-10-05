import { mock } from "bun:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { neonConfig } from "@neondatabase/serverless";
import { createPgliteFetch } from "./neon-pglite";

const client = new PGlite();
const migrations = new URL(
  "../../../../../packages/db/drizzle/",
  import.meta.url,
);
for (const file of (await readdir(migrations))
  .filter((file) => file.endsWith(".sql"))
  .sort()) {
  await client.exec(await readFile(new URL(file, migrations), "utf8"));
}
neonConfig.fetchFunction = await createPgliteFetch(client);
process.env.NEW_DATABASE_URL = "postgresql://test@local.invalid/names";
process.env.PARTICIPANT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString(
  "base64",
);
mock.module("server-only", () => ({}));
mock.module("../../challenges/early-access", () => ({
  hasChallengeEarlyAccess: async () => false,
}));
const identity = {
  clerkUserId: "user_names",
  email: "names@example.com",
  name: "Clerk Default",
  firstName: "Clerk",
  clerkPictureUrl: "https://img.clerk.com/test.png",
  canReviewApplications: false,
  tokenType: "oauth_token",
};
mock.module("../../auth", () => ({
  requireAuthenticatedParticipantProfile: async () => identity,
}));
mock.module("../../funnel-reminders/enqueue", () => ({
  enqueueFunnelReminderBestEffort: async () => {},
}));
mock.module("../../posthog-server", () => ({
  captureProductEvent: async () => {},
}));
const badgeJobs: Array<string> = [];
mock.module("../../badges/enqueue", () => ({
  enqueueBadgeGeneration: async (id: string) => {
    badgeJobs.push(id);
  },
}));
const { GET: login } = await import("../../../app/api/v1/me/route");
const { PATCH: editBadge } = await import("../../../app/api/v1/badge/route");
const { PUT: confirm } = await import(
  "../../../app/api/v1/registration/attendance/route"
);
const { createRegistration, getRegistration, submitAcceptedDetails } =
  await import("../service");
const { getParticipantBadge } = await import("../../badges/service");

const names = async () =>
  (
    await client.query(
      "select name, legal_name from participants where clerk_user_id = 'user_names'",
    )
  ).rows;
const request = (path: string, body: unknown, method = "POST") =>
  new Request(`http://localhost/api/v1/${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
assert.equal(
  (await login(new Request("http://localhost/api/v1/me"))).status,
  200,
);
assert.deepEqual(await names(), [{ name: "Clerk Default", legal_name: null }]);
const registration = await createRegistration(identity, {
  fullName: "Application Person",
  role: "Builder",
  countryCode: "PE",
  codeOfConductAccepted: true,
});
assert.deepEqual(await names(), [{ name: "Clerk Default", legal_name: null }]);
const applicationId = registration.registration.id;
await client.query(
  "update applications set status = 'accepted' where id = $1",
  [applicationId],
);
assert.equal(
  (await getParticipantBadge(identity.clerkUserId)).profile?.fullName,
  "Clerk Default",
);
const legalDetails = {
  fullName: "Legal Document Name",
  dateOfBirth: "1996-01-02",
  nationalIdNumber: "12345678",
  emergencyContactName: "Emergency Contact",
  emergencyContactPhone: "+51999999999",
  shirtSize: "m",
  pictureSource: "clerk",
};
assert.equal(
  (
    await confirm(
      request(
        "registration/attendance",
        { ...legalDetails, name: "Public Alias" },
        "PUT",
      ),
    )
  ).status,
  200,
);
assert.deepEqual(await names(), [
  { name: "Public Alias", legal_name: "Legal Document Name" },
]);
const confirmed = await getRegistration(identity.clerkUserId);
assert.equal(confirmed.registration.fullName, "Legal Document Name");
assert.equal(confirmed.registration.dateOfBirth, "1996-01-02");
assert.equal(confirmed.requirements.stage, "complete");
assert.equal(
  (await getParticipantBadge(identity.clerkUserId)).profile?.fullName,
  "Public Alias",
);
assert.deepEqual(badgeJobs, [applicationId]);
assert.deepEqual(
  (
    await client.query(
      "select first_completed_at = completed_at as same_time from acceptance_details where application_id = $1",
      [applicationId],
    )
  ).rows,
  [{ same_time: true }],
);
await client.query(
  "update acceptance_details set completed_at = '2026-09-20T15:00:00Z', first_completed_at = '2026-09-20T15:00:00Z' where application_id = $1",
  [applicationId],
);

assert.equal(
  (
    await editBadge(
      request(
        "badge",
        {
          fullName: "Badge Edit",
          oneLiner: "Builder",
          linkUrl: "https://example.com",
        },
        "PATCH",
      ),
    )
  ).status,
  200,
);
assert.deepEqual(await names(), [
  { name: "Badge Edit", legal_name: "Legal Document Name" },
]);
assert.equal(
  (await getParticipantBadge(identity.clerkUserId)).profile?.fullName,
  "Badge Edit",
);
assert.deepEqual(badgeJobs, [applicationId, applicationId]);
await login(new Request("http://localhost/api/v1/me"));
assert.deepEqual(await names(), [
  { name: "Badge Edit", legal_name: "Legal Document Name" },
]);

assert.equal(
  (
    await confirm(
      request(
        "registration/attendance",
        {
          ...legalDetails,
          fullName: "Corrected Legal Name",
          oneLiner: "Changed intro",
        },
        "PUT",
      ),
    )
  ).status,
  200,
);
assert.deepEqual(badgeJobs, [applicationId, applicationId, applicationId]);
assert.deepEqual(
  (
    await client.query(
      "select to_char(completed_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as confirmed_at, to_char(first_completed_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as first_confirmed_at from acceptance_details where application_id = $1",
      [applicationId],
    )
  ).rows,
  [
    {
      confirmed_at: "2026-09-20 15:00:00",
      first_confirmed_at: "2026-09-20 15:00:00",
    },
  ],
);
assert.equal(
  (await getParticipantBadge(identity.clerkUserId)).profile?.oneLiner,
  "Changed intro",
);
assert.deepEqual(await names(), [
  { name: "Badge Edit", legal_name: "Corrected Legal Name" },
]);
assert.equal(
  (await getRegistration(identity.clerkUserId)).registration.fullName,
  "Corrected Legal Name",
);

const before = (
  await client.query(
    "select name_sync_token from participants where clerk_user_id = 'user_names'",
  )
).rows;
await client.exec(`
  create function reject_name_test_details() returns trigger language plpgsql as $$
  begin raise exception 'test details persistence failure'; end $$;
  create trigger reject_name_test_details before update on acceptance_details
  for each row execute function reject_name_test_details();
`);
await assert.rejects(
  submitAcceptedDetails(identity, { ...legalDetails, name: "Must roll back" }),
  /test details persistence failure/,
);
assert.deepEqual(await names(), [
  { name: "Badge Edit", legal_name: "Corrected Legal Name" },
]);
assert.deepEqual(
  (
    await client.query(
      "select name_sync_token from participants where clerk_user_id = 'user_names'",
    )
  ).rows,
  before,
);
await client.exec(
  "drop trigger reject_name_test_details on acceptance_details",
);
await client.query(
  "update acceptance_details set first_completed_at = null where application_id = $1",
  [applicationId],
);
await submitAcceptedDetails(identity, {
  ...legalDetails,
  name: "After rollback",
});
assert.deepEqual(await names(), [
  { name: "After rollback", legal_name: "Legal Document Name" },
]);
assert.deepEqual(
  (
    await client.query(
      "select first_completed_at, to_char(completed_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as confirmed_at from acceptance_details where application_id = $1",
      [applicationId],
    )
  ).rows,
  [{ first_completed_at: null, confirmed_at: "2026-09-20 15:00:00" }],
);
assert.equal(
  (await getParticipantBadge(identity.clerkUserId)).profile?.fullName,
  "After rollback",
);
await client.query(
  "update acceptance_details set completed_at=null, first_completed_at=null where application_id=$1",
  [applicationId],
);
await submitAcceptedDetails(identity, legalDetails);
assert.deepEqual(
  (
    await client.query(
      "select completed_at is not null and first_completed_at = completed_at as first_completion_recorded from acceptance_details where application_id=$1",
      [applicationId],
    )
  ).rows,
  [{ first_completion_recorded: true }],
);
await client.close();
process.stdout.write("participant name lifecycle passed\n");
