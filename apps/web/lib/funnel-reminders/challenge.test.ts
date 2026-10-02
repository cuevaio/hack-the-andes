import { expect, test } from "bun:test";

import { isCurrentReminderAttempt, reminderChallenge } from "./challenge";

test("reminders target Broken Agent after Black Box has closed", () => {
  expect(
    reminderChallenge({
      now: new Date("2026-10-01T12:00:00Z"),
      forceOpen: false,
    })?.slug,
  ).toBe("broken-agent");
});

test("reminders target Slow Service without reopening the closed Scheduler", () => {
  expect(
    reminderChallenge({
      now: new Date("2027-01-01T12:00:00Z"),
      forceOpen: false,
    })?.slug,
  ).toBe("make-it-fast");
  expect(
    reminderChallenge({
      slug: "broken-agent",
      now: new Date("2027-01-01T12:00:00Z"),
      forceOpen: false,
    }),
  ).toBeUndefined();
});

test("reminders keep the triggering challenge when preview opens every challenge", () => {
  expect(
    reminderChallenge({
      slug: "broken-agent",
      now: new Date("2026-10-01T12:00:00Z"),
      forceOpen: true,
    })?.slug,
  ).toBe("broken-agent");
  expect(
    reminderChallenge({
      slug: "black-box",
      now: new Date("2026-10-01T12:00:00Z"),
      forceOpen: false,
    }),
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
