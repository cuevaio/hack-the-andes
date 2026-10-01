import { expect, test } from "bun:test";

import { isCurrentReminderAttempt, reminderChallenge } from "./challenge";

test("reminders target Broken Agent after Black Box has closed", () => {
  expect(reminderChallenge(new Date("2026-10-01T12:00:00Z"), false)?.slug).toBe(
    "broken-agent",
  );
});

test("reminders stop when no playable challenge is open", () => {
  expect(
    reminderChallenge(new Date("2027-01-01T12:00:00Z"), false),
  ).toBeUndefined();
});

test("reminders inspect each challenge's current version", () => {
  const attempts = [
    { challengeSlug: "black-box", challengeVersion: "black-box-v1" },
    { challengeSlug: "black-box", challengeVersion: "black-box-v2" },
    { challengeSlug: "broken-agent", challengeVersion: "broken-agent-v2" },
    { challengeSlug: "broken-agent", challengeVersion: "broken-agent-v3" },
    { challengeSlug: "unknown", challengeVersion: "unknown" },
  ];
  expect(attempts.filter(isCurrentReminderAttempt)).toEqual([
    { challengeSlug: "black-box", challengeVersion: "black-box-v2" },
    { challengeSlug: "broken-agent", challengeVersion: "broken-agent-v3" },
  ]);
});
