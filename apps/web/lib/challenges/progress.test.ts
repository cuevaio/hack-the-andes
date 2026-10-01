import { describe, expect, test } from "bun:test";

import {
  challengeCompletionDurationMs,
  challengeProgressStatus,
  earliestChallengeCompletionAt,
} from "./progress";

describe("challenge progress", () => {
  test("requires a persisted evaluation before reporting completion", () => {
    expect(
      challengeProgressStatus({
        hasPersistedEvaluation: false,
        hasAttempt: false,
      }),
    ).toBe("not_started");
    expect(
      challengeProgressStatus({
        hasPersistedEvaluation: false,
        hasAttempt: true,
      }),
    ).toBe("in_progress");
    expect(
      challengeProgressStatus({
        hasPersistedEvaluation: true,
        hasAttempt: true,
      }),
    ).toBe("evaluated");
  });
  test("public tests and pending browser approval count as started without spending budget", () => {
    expect(
      challengeProgressStatus({
        hasAttempt: true,
        hasPersistedEvaluation: false,
      }),
    ).toBe("in_progress");
  });
});

test("measures challenge completion from attempt creation", () => {
  expect(
    challengeCompletionDurationMs(
      new Date("2026-09-18T10:00:00.000Z"),
      new Date("2026-09-18T11:30:00.000Z"),
    ),
  ).toBe(5_400_000);
});

test("keeps the first successful evaluation as the completion time", () => {
  const first = new Date("2026-09-18T11:30:00.000Z");
  const later = new Date("2026-09-18T12:00:00.000Z");

  expect(earliestChallengeCompletionAt(undefined, later)).toBe(later);
  expect(earliestChallengeCompletionAt(later, first)).toBe(first);
  expect(earliestChallengeCompletionAt(first, later)).toBe(first);
});
