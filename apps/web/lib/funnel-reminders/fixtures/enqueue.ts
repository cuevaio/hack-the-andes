import { mock } from "bun:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

const client = new PGlite();
await client.exec(`
  create table participants (id text primary key, clerk_user_id text not null);
  create table applications (id text primary key, participant_id text not null, status text not null, created_at timestamptz not null default now());
  insert into participants values ('participant-fixture', 'user-fixture');
  insert into applications (id, participant_id, status) values ('application-fixture', 'participant-fixture', 'submitted');
`);
mock.module("@chofex/db", () => ({ db: drizzle(client) }));
let forceOpen = false;
mock.module("../../challenges/clock", () => ({
  currentChallengeTime: () => new Date("2026-10-01T12:00:00Z"),
  challengesForceOpen: () => forceOpen,
}));
const queued: { taskId: string; payload: unknown; options: unknown }[] = [];
mock.module("@trigger.dev/sdk", () => ({
  tasks: {
    trigger: async (taskId: string, payload: unknown, options: unknown) => {
      queued.push({ taskId, payload, options });
    },
  },
}));
const {
  enqueuePostSubmissionRemindersBestEffort,
  enqueueChallengeFinishReminderBestEffort,
} = await import("../enqueue");
await enqueuePostSubmissionRemindersBestEffort(
  "user-fixture",
  "application-fixture",
  [],
);
await enqueueChallengeFinishReminderBestEffort("user-fixture", "black-box");
await enqueueChallengeFinishReminderBestEffort("user-fixture", "broken-agent");
assert.deepEqual(queued, [
  {
    taskId: "send-funnel-reminder",
    payload: {
      clerkUserId: "user-fixture",
      applicationId: "application-fixture",
      stage: "challenge_start",
      challengeSlug: "broken-agent",
    },
    options: {
      delay: "2h",
      idempotencyKey:
        "funnel-reminder/challenge_start/user-fixture/application/application-fixture/broken-agent/broken-agent-v3",
      idempotencyKeyTTL: "7d",
      tags: ["funnel_challenge_start", "clerk_user_user-fixture"],
    },
  },
  {
    taskId: "send-funnel-reminder",
    payload: {
      clerkUserId: "user-fixture",
      applicationId: "application-fixture",
      stage: "challenge_finish",
      challengeSlug: "broken-agent",
    },
    options: {
      delay: "2h",
      idempotencyKey:
        "funnel-reminder/challenge_finish/user-fixture/application/application-fixture/broken-agent/broken-agent-v3",
      idempotencyKeyTTL: "7d",
      tags: ["funnel_challenge_finish", "clerk_user_user-fixture"],
    },
  },
]);
queued.length = 0;
forceOpen = true;
await enqueueChallengeFinishReminderBestEffort("user-fixture", "broken-agent");
await enqueuePostSubmissionRemindersBestEffort(
  "user-fixture",
  "application-fixture",
  [
    {
      slug: "broken-agent",
      title: "The Scheduler",
      theme: "Broken Agent",
      status: "in_progress",
      open: true,
      playable: true,
      queriesUsed: 0,
      queriesLimit: 0,
      evaluationsUsed: 0,
      evaluationsLimit: 5,
    },
  ],
);
assert.deepEqual(
  queued.map((item) => item.payload),
  [
    {
      clerkUserId: "user-fixture",
      applicationId: "application-fixture",
      stage: "challenge_finish",
      challengeSlug: "broken-agent",
    },
    {
      clerkUserId: "user-fixture",
      applicationId: "application-fixture",
      stage: "challenge_start",
      challengeSlug: "broken-agent",
    },
    {
      clerkUserId: "user-fixture",
      applicationId: "application-fixture",
      stage: "challenge_finish",
      challengeSlug: "broken-agent",
    },
  ],
);
const queuedBeforeFailure = queued.length;
await client.exec("drop table applications");
const originalConsoleError = console.error;
const errors: unknown[] = [];
console.error = (...args: unknown[]) => {
  errors.push(args);
};
try {
  await enqueueChallengeFinishReminderBestEffort(
    "user-fixture",
    "broken-agent",
  );
  assert.equal(queued.length, queuedBeforeFailure);
  assert.equal(errors.length, 1);
} finally {
  console.error = originalConsoleError;
  await client.close();
}
process.stdout.write("reminder enqueue passed\n");
