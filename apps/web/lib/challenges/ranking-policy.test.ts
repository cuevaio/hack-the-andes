import { describe, expect, test } from "bun:test";
import type { ChallengeScore } from "@chofex/challenges-contract";
import {
  compareRankedChallengeEvaluations,
  competitionRanks,
  competitionRanksBy,
  publicRankingEntries,
} from "./ranking-policy";

const score = (overrides: Partial<ChallengeScore> = {}): ChallengeScore => ({
  accuracy: 0.9,
  exactCount: 900,
  sampleSize: 1_000,
  meanError: 0.1,
  queriesUsed: 10,
  runtimeMs: 20,
  ...overrides,
});

describe("challenge ranking policy", () => {
  test("Slow Service ranks points, fewer official evaluations and earliest best, not raw CPU", () => {
    const left = {
      score: score({
        challengeSlug: "make-it-fast",
        evaluationsUsed: 2,
        runtimeMs: 900,
        executionCost: 900_000,
      }),
      evaluatedAt: new Date("2026-10-02T12:00:00Z"),
    };
    const right = {
      score: score({
        challengeSlug: "make-it-fast",
        evaluationsUsed: 3,
        runtimeMs: 1,
        executionCost: 1_000,
      }),
      evaluatedAt: new Date("2026-10-02T11:00:00Z"),
    };
    expect(compareRankedChallengeEvaluations(left, right)).toBeLessThan(0);
    expect(
      compareRankedChallengeEvaluations(left, {
        ...right,
        score: { ...right.score, evaluationsUsed: 2 },
      }),
    ).toBeGreaterThan(0);
    expect(
      compareRankedChallengeEvaluations(left, {
        ...right,
        score: { ...right.score, accuracy: 0.8 },
      }),
    ).toBeLessThan(0);
  });
  test("breaks otherwise identical scores by their numeric execution cost", () => {
    expect(
      competitionRanks([
        score({ runtimeMs: 1_000 }),
        score(),
        score({ accuracy: 0.8, exactCount: 800 }),
      ]),
    ).toEqual([1, 2, 3]);
  });

  test("shows only the first 17 ranked entries", () => {
    const ranked = Array.from({ length: 20 }, (_, index) => ({
      position: index + 1,
    }));

    expect(publicRankingEntries(ranked)).toEqual(ranked.slice(0, 17));
  });

  test("supports final tie breakers that produce distinct ranks", () => {
    const entries = [
      { score: 100, submittedAt: 1 },
      { score: 100, submittedAt: 2 },
      { score: 90, submittedAt: 3 },
    ];

    expect(
      competitionRanksBy(entries, (left, right) => {
        if (left.score !== right.score) return right.score - left.score;
        return left.submittedAt - right.submittedAt;
      }),
    ).toEqual([1, 2, 3]);
  });
});
