import { describe, expect, test } from "bun:test";
import { Schema } from "effect";

import {
  BrokenAgentEvaluationSolutionSchema,
  challengeAdmissionNotice,
  challengeBySlug,
  challengeOpeningNotice,
  compareChallengeScores,
  formatChallengeOpeningInPeru,
  isChallengeOpenAt,
  isChallengeRankingVisibleAt,
  ParticipantChallengeMilestoneSchema,
  ParticipantChallengeProgressSchema,
  ShipmentSchema,
  scoreFromPredictions,
} from "./index.js";

describe("challenge catalog", () => {
  test("states that ranked challenges determine admission", () => {
    expect(challengeAdmissionNotice).toContain("obligatorios");
    expect(challengeAdmissionNotice).toContain("no reserva una plaza");
    expect(challengeAdmissionNotice).toContain("versión vigente");
    expect(challengeAdmissionNotice).toContain("intentos legacy no cuentan");
    expect(challengeAdmissionNotice).toContain("rankings");
  });

  test("keeps the first two challenges playable and later challenges locked", () => {
    expect(challengeBySlug("broken-agent")?.playable).toBe(true);
    expect(challengeBySlug("broken-agent")?.evaluationLimit).toBe(5);
    expect(challengeBySlug("broken-agent")?.solutionKind).toBe(
      "javascript_source",
    );
    expect(challengeBySlug("black-box")?.queryLimit).toBe(25);
    expect(challengeBySlug("black-box")?.evaluationLimit).toBe(3);
  });

  test("opens Black Box on 17 September 2026 at 09:00 UTC-5", () => {
    const challenge = challengeBySlug("black-box");
    if (!challenge) throw new Error("missing black-box");
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-17T13:59:59.999Z")),
    ).toBe(false);
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-17T14:00:00.000Z")),
    ).toBe(true);
    expect(formatChallengeOpeningInPeru(challenge.opensAt)).toBe(
      "17 de septiembre de 2026 a las 09:00 (UTC-5)",
    );
    expect(challengeOpeningNotice(challenge.title, challenge.opensAt)).toBe(
      "The Shipping Machine abre el 17 de septiembre de 2026 a las 09:00 (UTC-5). Las consultas y evaluaciones están deshabilitadas hasta entonces; no se consumirá ningún intento.",
    );
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-17T00:00:00.000Z"), true),
    ).toBe(true);
  });

  test("closes Black Box before Challenge 2 launches", () => {
    const challenge = challengeBySlug("black-box");
    if (!challenge) throw new Error("missing black-box");

    expect(challenge.closesAt).toBe("2026-09-24T17:20:00.000Z");
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-24T17:19:59.999Z")),
    ).toBe(true);
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-24T17:20:00.000Z")),
    ).toBe(false);
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-24T17:20:00.000Z"), true),
    ).toBe(true);
  });

  test("opens Broken Agent on 24 September 2026 at 14:25 UTC-5", () => {
    const challenge = challengeBySlug("broken-agent");
    if (!challenge) throw new Error("missing broken-agent");

    expect(challenge.opensAt).toBe("2026-09-24T19:25:00.000Z");
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-24T19:24:59.999Z")),
    ).toBe(false);
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-24T19:25:00.000Z")),
    ).toBe(true);
  });

  test("closes Broken Agent when Challenge 3 opens and reveals its ranking first", () => {
    const challenge = challengeBySlug("broken-agent");
    if (!challenge) throw new Error("missing broken-agent");

    expect(challenge.rankingVisibleAt).toBe("2026-10-01T20:00:00.000Z");
    expect(challenge.closesAt).toBe("2026-10-02T05:00:00.000Z");
    expect(
      isChallengeRankingVisibleAt(
        challenge,
        new Date("2026-10-01T19:59:59.999Z"),
      ),
    ).toBe(false);
    expect(
      isChallengeRankingVisibleAt(
        challenge,
        new Date("2026-10-01T20:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      isChallengeOpenAt(challenge, new Date("2026-10-02T04:59:59.999Z")),
    ).toBe(true);
    expect(
      isChallengeOpenAt(challenge, new Date("2026-10-02T05:00:00.000Z")),
    ).toBe(false);
  });

  test("closes Slow Service submissions while keeping its ranking available", () => {
    const challenge = challengeBySlug("make-it-fast");
    if (!challenge) throw new Error("missing make-it-fast");

    expect(challenge.closesAt).toBe("2026-10-05T18:51:16.000Z");
    expect(
      isChallengeOpenAt(challenge, new Date("2026-10-05T18:51:15.999Z")),
    ).toBe(true);
    expect(
      isChallengeOpenAt(challenge, new Date("2026-10-05T18:51:16.000Z")),
    ).toBe(false);
    expect(
      isChallengeRankingVisibleAt(
        challenge,
        new Date("2026-10-05T18:51:16.000Z"),
      ),
    ).toBe(true);
    expect(challenge.playable).toBe(true);
  });

  test("keeps Challenge 4 ranking private until Friday 9 October 2026 at 00:00 UTC-5", () => {
    const challenge = challengeBySlug("power-grid");
    if (!challenge) throw new Error("missing power-grid");

    expect(challenge.number).toBe(4);
    expect(challenge.rankingVisibleAt).toBe("2026-10-09T05:00:00.000Z");
    expect(
      isChallengeRankingVisibleAt(
        challenge,
        new Date("2026-10-09T04:59:59.999Z"),
      ),
    ).toBe(false);
    expect(
      isChallengeRankingVisibleAt(
        challenge,
        new Date("2026-10-09T05:00:00.000Z"),
      ),
    ).toBe(true);
  });

  test("reveals the Black Box ranking on 23 September 2026 at 15:00 UTC-5", () => {
    const challenge = challengeBySlug("black-box");
    if (!challenge) throw new Error("missing black-box");

    expect(challenge.rankingVisibleAt).toBe("2026-09-23T20:00:00.000Z");
    expect(
      isChallengeRankingVisibleAt(
        challenge,
        new Date("2026-09-23T19:59:59.999Z"),
      ),
    ).toBe(false);
    expect(
      isChallengeRankingVisibleAt(
        challenge,
        new Date("2026-09-23T20:00:00.000Z"),
      ),
    ).toBe(true);
  });
});

describe("participant challenge progress", () => {
  test("carries the elapsed time to the first completed evaluation", () => {
    const progress = Schema.decodeUnknownSync(
      ParticipantChallengeProgressSchema,
    )({
      slug: "black-box",
      title: "The Shipping Machine",
      theme: "Black Box",
      status: "evaluated",
      open: true,
      playable: true,
      queriesUsed: 10,
      queriesLimit: 25,
      evaluationsUsed: 1,
      evaluationsLimit: 3,
      bestAccuracy: 0.98,
      completionDurationMs: 5_400_000,
    });

    expect(progress.completionDurationMs).toBe(5_400_000);
  });

  test("carries historical challenge milestone timestamps", () => {
    const milestone = Schema.decodeUnknownSync(
      ParticipantChallengeMilestoneSchema,
    )({
      attemptId: "attempt-1",
      slug: "retired-challenge",
      title: "Retired challenge",
      startedAt: "2026-09-03T09:00:00.000Z",
      completedAt: "2026-09-03T10:00:00.000Z",
    });

    expect(milestone.slug).toBe("retired-challenge");
    expect(milestone.completedAt).toBe("2026-09-03T10:00:00.000Z");
  });
});

describe("challenge scoring", () => {
  test("treats exact matches as full accuracy and uses query count as a tie breaker", () => {
    const perfect = scoreFromPredictions([10, 20, 30], [10, 20, 30], 12, 8);
    const close = scoreFromPredictions([10, 20, 30], [10, 20, 35], 4, 1);
    expect(perfect.accuracy).toBe(1);
    expect(perfect.exactCount).toBe(3);
    expect(close.accuracy).toBeCloseTo(2 / 3);
    expect(close.meanError).toBeCloseTo(5 / 3);
    expect(compareChallengeScores(perfect, close)).toBeLessThan(0);

    const fewerQueries = { ...perfect, queriesUsed: 8 };
    expect(compareChallengeScores(fewerQueries, perfect)).toBeLessThan(0);
  });

  test("uses runtime to break otherwise identical scores", () => {
    const score = scoreFromPredictions([10, 20], [10, 20], 8, 1);
    expect(
      compareChallengeScores(score, { ...score, runtimeMs: 10_000 }),
    ).toBeLessThan(0);
  });

  test("breaks Broken Agent ties by fewer evaluations, not by execution cost", () => {
    const breakdown = {
      coreBehavior: { earned: 10, available: 10 },
      persistence: { earned: 15, available: 15 },
      concurrency: { earned: 20, available: 20 },
      failureRecovery: { earned: 20, available: 20 },
      idempotency: { earned: 15, available: 15 },
      regressionSafety: { earned: 15, available: 15 },
      performance: { earned: 5, available: 5 },
    };
    const base = {
      accuracy: 1,
      exactCount: 100,
      sampleSize: 100,
      meanError: 0,
      queriesUsed: 0,
      runtimeMs: 50,
      executionCost: 50,
      evaluationsUsed: 2,
      breakdown,
    };

    expect(
      compareChallengeScores(base, { ...base, evaluationsUsed: 3 }),
    ).toBeLessThan(0);
    expect(compareChallengeScores(base, { ...base, executionCost: 60 })).toBe(
      0,
    );
  });
});

describe("challenge inputs", () => {
  test("accepts only whole distance and weight values", () => {
    const decode = Schema.decodeUnknownSync(ShipmentSchema);
    const base = {
      distanceKm: 10,
      weightKg: 3,
      hour: 14,
      fragile: false,
      express: false,
    };

    expect(decode(base)).toEqual(base);
    expect(() => decode({ ...base, distanceKm: 10.5 })).toThrow();
    expect(() => decode({ ...base, weightKg: 3.5 })).toThrow();
  });

  test("requires a substantive human review for Broken Agent evaluations", () => {
    const decode = Schema.decodeUnknownSync(
      BrokenAgentEvaluationSolutionSchema,
      {
        onExcessProperty: "error",
      },
    );
    const solution = {
      kind: "javascript_source",
      source: "function createScheduler() {}",
      review: {
        sourceDigest:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        focus: "lease_recovery",
        failureScenario:
          "Un worker vence mientras ejecuta y su resultado tardío pisa el claim nuevo.",
        evidence:
          "Revisé el test con dos workers y confirmé que el claim obsoleto no cambia el estado.",
        decision: "ship",
        confidence: 82,
        remainingRisk:
          "Todavía falta observar el comportamiento del store real bajo carga sostenida.",
      },
    };

    expect(decode(solution).review.focus).toBe("lease_recovery");
    expect(() =>
      decode({ kind: solution.kind, source: solution.source }),
    ).toThrow();
    expect(() =>
      decode({
        ...solution,
        review: { ...solution.review, failureScenario: "Agent says it works" },
      }),
    ).toThrow();
    expect(() =>
      decode({
        ...solution,
        review: { ...solution.review, evidence: " ".repeat(80) },
      }),
    ).toThrow();
    expect(() =>
      decode({
        ...solution,
        review: { ...solution.review, confidence: 101 },
      }),
    ).toThrow();
  });
});
