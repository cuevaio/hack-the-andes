import { mock } from "bun:test";
import assert from "node:assert/strict";

mock.module("@chofex/db", () => ({ db: {} }));
mock.module("../../challenges/clock", () => ({
  currentChallengeTime: () => new Date("2026-10-01T12:00:00Z"),
  challengesForceOpen: () => false,
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
  false,
);
await enqueueChallengeFinishReminderBestEffort(
  "user-fixture",
  "application-fixture",
  "black-box",
);
await enqueueChallengeFinishReminderBestEffort(
  "user-fixture",
  "application-fixture",
  "broken-agent",
);
assert.deepEqual(queued, [
  {
    taskId: "send-funnel-reminder",
    payload: {
      clerkUserId: "user-fixture",
      applicationId: "application-fixture",
      stage: "challenge_start",
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
process.stdout.write("reminder enqueue passed\n");
