import { expect, test } from "bun:test";

import {
  formatChallengeScore,
  participantVisibleScore,
  scoreFromStored,
} from "./score";

test("formats challenge scores consistently for public and admin rankings", () => {
  expect(formatChallengeScore(0.98765)).toBe("98.77%");
  expect(formatChallengeScore(1)).toBe("100.00%");
});

test("restores the Slow Service ranking identity and public diagnostic CPU without a breakdown", () => {
  const score = scoreFromStored({
    accuracy: 0.9,
    exactCount: 90,
    sampleSize: 100,
    meanError: 10,
    queriesUsed: 0,
    runtimeMs: 70,
    executionCost: 70_000,
    solution: {
      challengeSlug: "make-it-fast",
      source: "function createLedger() {}",
    },
  });
  expect(score.challengeSlug).toBe("make-it-fast");
  expect(participantVisibleScore(score)).toEqual({
    accuracy: 0.9,
    exactCount: 90,
    sampleSize: 100,
    meanError: 10,
    queriesUsed: 0,
    runtimeMs: 70,
    executionCost: 70_000,
  });
});

test("restores Broken Agent deterministic cost without calling it runtime", () => {
  const score = scoreFromStored({
    accuracy: 0.8,
    exactCount: 80,
    sampleSize: 100,
    meanError: 20,
    queriesUsed: 0,
    runtimeMs: 0,
    executionCost: 4321,
    solution: {
      scoreBreakdown: {
        coreBehavior: { earned: 10, available: 10 },
        persistence: { earned: 15, available: 15 },
        concurrency: { earned: 8, available: 20 },
        failureRecovery: { earned: 10, available: 20 },
        idempotency: { earned: 11, available: 15 },
        regressionSafety: { earned: 15, available: 15 },
        performance: { earned: 0, available: 5 },
      },
    },
  });

  expect(score.runtimeMs).toBe(0);
  expect(score.executionCost).toBe(4321);
  expect(score.breakdown?.concurrency.earned).toBe(8);

  const visible = participantVisibleScore(score);
  expect(visible.executionCost).toBeUndefined();
  expect(visible.breakdown).toBeUndefined();
  expect(visible.exactCount).toBe(80);
});
