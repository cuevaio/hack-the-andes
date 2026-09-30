import { describe, expect, test } from "bun:test";

import {
  challengeEvaluateText,
  challengeLaunchNotice,
  challengeListText,
  challengeParticipationNotice,
  challengeRankingText,
  notebookTableText,
} from "../src/challenge-output.js";

describe("challenge output", () => {
  test("notifies users of the exact local opening time before launch", () => {
    const opensAt = "2026-09-17T14:00:00.000Z";
    expect(
      challengeLaunchNotice(
        "Black Box",
        opensAt,
        new Date("2026-09-17T13:59:59.999Z"),
      ),
    ).toBe(
      "Black Box abre el 17 de septiembre de 2026 a las 09:00 (UTC-5). Las consultas y evaluaciones están deshabilitadas hasta entonces; no se consumirá ningún intento.",
    );
    expect(
      challengeLaunchNotice(
        "Black Box",
        opensAt,
        new Date("2026-09-17T14:00:00.000Z"),
      ),
    ).toBeUndefined();

    const text = challengeListText({
      challenges: [
        {
          slug: "black-box",
          number: 1,
          code: "01",
          theme: "Black Box",
          title: "The Shipping Machine",
          summary: "Reverse engineer the machine.",
          coreSkill: "Reverse engineering",
          format: "accuracy",
          formatLabel: "Accuracy score",
          opensAt,
          queryLimit: 25,
          evaluationLimit: 3,
          playable: true,
          open: false,
          challengeVersion: "black-box-v2",
          rankingPath: "/challenges/black-box",
        },
      ],
    });
    expect(text).toContain("abre 17 de septiembre de 2026 a las 09:00 (UTC-5)");
    expect(text).toContain("challenges técnicos son obligatorios");
    expect(text).toContain("no reserva una plaza");
    expect(text).toContain("Versión vigente: black-box-v2");
  });

  test("labels a finished challenge as closed", () => {
    const text = challengeListText({
      challenges: [
        {
          slug: "black-box",
          number: 1,
          code: "01",
          theme: "Black Box",
          title: "The Shipping Machine",
          summary: "Reverse engineer the machine.",
          coreSkill: "Reverse engineering",
          format: "accuracy",
          formatLabel: "Accuracy score",
          opensAt: "2026-09-17T14:00:00.000Z",
          closesAt: "2026-09-24T17:20:00.000Z",
          queryLimit: 25,
          evaluationLimit: 3,
          playable: true,
          open: false,
          closed: true,
          rankingPath: "/challenges/black-box",
        },
      ],
    });

    expect(text).toContain("cerrado");
    expect(text).not.toContain("abre 17 de septiembre");
    expect(text).not.toContain("Empieza el challenge abierto");
    expect(text).toContain("No hay un challenge abierto");
    expect(
      challengeParticipationNotice(
        "Black Box",
        "2026-09-17T14:00:00.000Z",
        "2026-09-24T17:20:00.000Z",
        new Date("2026-09-24T17:20:00.000Z"),
      ),
    ).toContain("está cerrado");
    const closedNotebook = notebookTableText([], true);
    expect(closedNotebook).toContain("challenge está cerrado");
    expect(closedNotebook).toContain("andes challenge ranking");
    expect(closedNotebook).not.toContain("andes challenge query");
  });

  test("prints official evaluation score details and a share card", () => {
    const text = challengeEvaluateText({
      accuracy: 0.9742,
      exactCount: 812,
      sampleSize: 1000,
      meanError: 1.84,
      queriesUsed: 18,
      runtimeMs: 12,
      shareCode: "7A3F",
      rank: 17,
      competitorCount: 120,
      percentile: 14.2,
      evaluationsUsed: 1,
      evaluationsRemaining: 2,
      evaluationsLimit: 3,
      rankingPath: "/challenges/black-box",
      shareText: [
        "🕵️ BLACK BOX #7A3F",
        "97.42% replication",
        "18 / 25 queries used",
        "Top 14.2%",
        "Can you reverse engineer yours?",
      ].join("\n"),
    });

    expect(text).toContain("BLACK BOX REPLICATION");
    expect(text).toContain("97.42%");
    expect(text).toContain("812 / 1000");
    expect(text).toContain("#17");
    expect(text).toContain("2 / 3");
    expect(text).toContain("BLACK BOX #7A3F");
  });

  test("prints a single Broken Agent score without capability or cost detail", () => {
    const text = challengeEvaluateText({
      accuracy: 0.82,
      exactCount: 82,
      sampleSize: 100,
      meanError: 18,
      queriesUsed: 0,
      runtimeMs: 120,
      executionCost: 4321,
      shareCode: "SHIP",
      evaluationsUsed: 2,
      evaluationsRemaining: 3,
      evaluationsLimit: 5,
      rankingPath: "/challenges/broken-agent",
      shareText: "82.00% production readiness",
      breakdown: {
        coreBehavior: { earned: 10, available: 10 },
        persistence: { earned: 12, available: 15 },
        concurrency: { earned: 16, available: 20 },
        failureRecovery: { earned: 14, available: 20 },
        idempotency: { earned: 13, available: 15 },
        regressionSafety: { earned: 12, available: 15 },
        performance: { earned: 5, available: 5 },
      },
    });

    expect(text).toContain("BROKEN AGENT — PREPARACIÓN PARA PRODUCCIÓN");
    expect(text).toContain("82.00 / 100");
    expect(text).not.toContain("Concurrencia");
    expect(text).not.toContain("16.00 / 20");
    expect(text).not.toContain("4321 ops");
    expect(text).not.toContain("worker_crash");
  });

  test("still reports a persisted evaluation when ranking is unavailable", () => {
    const text = challengeEvaluateText({
      accuracy: 0.9,
      exactCount: 900,
      sampleSize: 1000,
      meanError: 2,
      queriesUsed: 20,
      runtimeMs: 10,
      shareCode: "7A3F",
      evaluationsUsed: 1,
      evaluationsRemaining: 2,
      evaluationsLimit: 3,
      rankingPath: "/challenges/black-box",
      shareText: "90.00% replication",
    });

    expect(text).not.toContain("Rank");
    expect(text).not.toContain("undefined");
    expect(text).toContain("2 / 3");
  });

  test("shows the ranking release without claiming there are no evaluations", () => {
    const text = challengeRankingText(
      {
        challenge: {
          slug: "black-box",
          number: 1,
          code: "01",
          theme: "Black Box",
          title: "The Shipping Machine",
          summary: "Reverse engineer the machine.",
          coreSkill: "Reverse engineering",
          format: "accuracy",
          formatLabel: "Accuracy score",
          opensAt: "2026-09-17T14:00:00.000Z",
          rankingVisibleAt: "2026-09-23T20:00:00.000Z",
          queryLimit: 25,
          evaluationLimit: 3,
          playable: true,
          open: true,
          rankingPath: "/challenges/black-box",
        },
        entries: [],
        competitorCount: 0,
      },
      new Date("2026-09-23T19:00:00.000Z"),
    );

    expect(text).toContain(
      "Ranking disponible 23 de septiembre de 2026 a las 15:00 (UTC-5).",
    );
    expect(text).not.toContain("0 official evaluations");
  });

  test("does not reveal the hidden competitor count", () => {
    const text = challengeRankingText(
      {
        challenge: {
          slug: "black-box",
          number: 1,
          code: "01",
          theme: "Black Box",
          title: "The Shipping Machine",
          summary: "Reverse engineer the machine.",
          coreSkill: "Reverse engineering",
          format: "accuracy",
          formatLabel: "Accuracy score",
          opensAt: "2026-09-17T14:00:00.000Z",
          rankingVisibleAt: "2026-09-23T20:00:00.000Z",
          queryLimit: 25,
          evaluationLimit: 3,
          playable: true,
          open: true,
          rankingPath: "/challenges/black-box",
        },
        entries: [
          {
            rank: 1,
            displayName: "Winner",
            shareCode: "ABCD",
            githubUrl: "https://github.com/winner",
            linkedInUrl: "https://linkedin.com/in/winner",
            accuracy: 1,
            exactCount: 1_000,
            sampleSize: 1_000,
            meanError: 0,
            queriesUsed: 25,
            runtimeMs: 10,
            evaluatedAt: "2026-09-23T20:00:00.000Z",
          },
        ],
        competitorCount: 58,
      },
      new Date("2026-09-24T00:00:00.000Z"),
    );

    expect(text).toContain("Winner");
    expect(text).toContain("https://github.com/winner");
    expect(text).toContain("https://linkedin.com/in/winner");
    expect(text).not.toContain("#ABCD");
    expect(text).not.toContain("58 official evaluations");
  });
});
