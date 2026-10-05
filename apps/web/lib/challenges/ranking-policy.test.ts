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
  test("Slow Service ranks points, earliest best result and then fewer evaluations", () => {
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
    expect(compareRankedChallengeEvaluations(left, right)).toBeGreaterThan(0);
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
    expect(
      compareRankedChallengeEvaluations(left, {
        ...right,
        evaluatedAt: left.evaluatedAt,
      }),
    ).toBeLessThan(0);
    expect(
      compareRankedChallengeEvaluations(left, {
        ...right,
        score: { ...right.score, evaluationsUsed: 2 },
        evaluatedAt: left.evaluatedAt,
      }),
    ).toBe(0);
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

  test("keeps the first 17 entries for other challenges", () => {
    const ranked = Array.from({ length: 20 }, (_, index) => ({
      position: index + 1,
      accuracy: 0.9,
    }));

    for (const slug of ["black-box", "power-grid"]) {
      expect(publicRankingEntries({ slug, ranked })).toEqual(
        ranked.slice(0, 17),
      );
    }
  });

  test("publishes every Slow Service result beyond position 17", () => {
    const ranked = Array.from({ length: 34 }, (_, index) => ({
      position: index + 1,
      accuracy: index < 24 ? 1 : 0.6,
    }));
    expect(publicRankingEntries({ slug: "make-it-fast", ranked })).toEqual(
      ranked,
    );
  });

  test("shows every Broken Agent score of at least 95%, beyond position 17", () => {
    const ranked = Array.from({ length: 22 }, (_, index) => ({
      position: index + 1,
      accuracy: index < 19 ? 0.97 : 0.95,
    }));
    ranked.push({ position: 23, accuracy: 0.9499 });

    expect(
      publicRankingEntries({ slug: "broken-agent", ranked }).map(
        (entry) => entry.position,
      ),
    ).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      22,
    ]);
  });

  test("excludes Broken Agent scores below 95% even within the first 17", () => {
    expect(
      publicRankingEntries({
        slug: "broken-agent",
        ranked: [
          { position: 1, accuracy: 1 },
          { position: 2, accuracy: 0.95 },
          { position: 3, accuracy: 0.9499 },
          { position: 4, accuracy: 0.8 },
        ],
      }),
    ).toEqual([
      { position: 1, accuracy: 1 },
      { position: 2, accuracy: 0.95 },
    ]);
  });

  test("returns no Broken Agent entries when nobody meets 95%", () => {
    expect(
      publicRankingEntries({
        slug: "broken-agent",
        ranked: [{ accuracy: 0.94 }],
      }),
    ).toEqual([]);
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
