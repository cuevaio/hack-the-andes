import { mock } from "bun:test";
import assert from "node:assert/strict";

mock.module("server-only", () => ({}));
mock.module("@/lib/auth", () => ({
  requireParticipantUserId: async () => "user-fixture",
}));
mock.module("@/lib/posthog-server", () => ({
  captureProductEvent: async () => {},
}));
mock.module("@/lib/public-origin", () => ({
  publicRequestOrigin: () => "https://hacktheandes.com",
}));
const { HttpError } = await import("../../registration/http");
let evaluationFailure = "HUMAN_APPROVAL_REQUIRED";
let progressStatus = "not_started";
mock.module("@/lib/challenges/service", () => ({
  getChallengeAttempt: async () => ({ progress: { status: progressStatus } }),
  testChallengeSolution: async () => ({ accuracy: 1, observationCount: 7 }),
  evaluateChallenge: async () => {
    throw new HttpError(409, evaluationFailure, "fixture");
  },
}));
const reminders: unknown[] = [];
mock.module("@/lib/funnel-reminders/enqueue", () => ({
  enqueueChallengeFinishReminderBestEffort: async (
    userId: string,
    challengeSlug: string,
  ) => {
    reminders.push({ userId, challengeSlug });
  },
}));
const showRoute = await import("../../../app/api/v1/challenges/[slug]/route");
const testRoute = await import(
  "../../../app/api/v1/challenges/[slug]/test/route"
);
const evaluateRoute = await import(
  "../../../app/api/v1/challenges/[slug]/evaluate/route"
);
const context = { params: Promise.resolve({ slug: "broken-agent" }) };
const post = () =>
  new Request("https://hacktheandes.com/api/v1/challenges/broken-agent/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source: "fixture" }),
  });
assert.equal(
  (
    await showRoute.GET(
      new Request("https://hacktheandes.com/api/v1/challenges/broken-agent"),
      context,
    )
  ).status,
  200,
);
assert.deepEqual(reminders, []);
progressStatus = "in_progress";
assert.equal(
  (
    await showRoute.GET(
      new Request("https://hacktheandes.com/api/v1/challenges/broken-agent"),
      context,
    )
  ).status,
  200,
);
progressStatus = "evaluated";
await showRoute.GET(
  new Request("https://hacktheandes.com/api/v1/challenges/broken-agent"),
  context,
);
assert.equal(reminders.length, 1);
assert.equal((await testRoute.POST(post(), context)).status, 200);
assert.equal((await evaluateRoute.POST(post(), context)).status, 409);
evaluationFailure = "SOLUTION_EXECUTION_FAILED";
assert.equal((await evaluateRoute.POST(post(), context)).status, 409);
assert.deepEqual(
  reminders,
  Array.from({ length: 4 }, () => ({
    userId: "user-fixture",
    challengeSlug: "broken-agent",
  })),
);
evaluationFailure = "VALIDATION_ERROR";
await evaluateRoute.POST(post(), context);
assert.equal(reminders.length, 4);
process.stdout.write("reminder routes passed\n");
