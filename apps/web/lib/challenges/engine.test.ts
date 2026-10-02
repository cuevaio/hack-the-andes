import { describe, expect, test } from "bun:test";

import type { Shipment } from "@chofex/challenges-contract";
import { slowServiceChallengeVersion } from "@chofex/challenges-contract/slow-service";

import {
  brokenAgentChallengeVersion,
  ChallengeEngineError,
  challengeEngineEvaluateTimeoutMs,
  challengeEngineQueryTimeoutMs,
  createChallengeEngine,
  currentChallengeVersion,
  currentChallengeVersionFor,
  slowServiceEngineEvaluateTimeoutMs,
} from "./engine";

const shipment: Shipment = {
  distanceKm: 12,
  weightKg: 3,
  hour: 14,
  fragile: false,
  express: false,
};

describe("private challenge engine adapter", () => {
  test("Slow Service uses the existing v1 evaluate envelope and preserves CPU diagnostics", async () => {
    let request: unknown;
    const engine = createChallengeEngine({
      baseUrl: "https://private-engine.example",
      apiSecret: "test",
      fetch: async (_url, init) => {
        request = JSON.parse(String(init?.body));
        return Response.json({
          version: 1,
          score: {
            accuracy: 0.85,
            exactCount: 85,
            sampleSize: 100,
            meanError: 15,
            queriesUsed: 0,
            runtimeMs: 321,
            executionCost: 321_000,
          },
        });
      },
    });
    expect(currentChallengeVersionFor("make-it-fast")).toBe("slow-service-v3");
    const score = await engine.evaluate(
      slowServiceChallengeVersion,
      "attempt-1",
      "function createLedger() {}",
      0,
    );
    expect(request).toEqual({
      version: 1,
      challengeVersion: "slow-service-v3",
      participantKey: "attempt-1",
      source: "function createLedger() {}",
      queriesUsed: 0,
    });
    expect(score).toEqual({
      challengeSlug: "make-it-fast",
      accuracy: 0.85,
      exactCount: 85,
      sampleSize: 100,
      meanError: 15,
      queriesUsed: 0,
      runtimeMs: 321,
      executionCost: 321_000,
    });
  });
  test("pins Broken Agent submissions to the current admission version", () => {
    expect(brokenAgentChallengeVersion).toBe("broken-agent-v3");
  });

  test("gives official evaluations longer than a query", () => {
    expect(challengeEngineEvaluateTimeoutMs).toBeGreaterThan(
      challengeEngineQueryTimeoutMs,
    );
    expect(challengeEngineEvaluateTimeoutMs).toBeGreaterThanOrEqual(25_000);
  });

  test("keeps the official evaluate route alive for the engine budget", async () => {
    const route = await Bun.file(
      new URL(
        "../../app/api/v1/challenges/[slug]/evaluate/route.ts",
        import.meta.url,
      ),
    ).text();
    expect(route).toContain("export const maxDuration = 360");
  });

  test("authenticates and maps query and evaluation responses", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });
      if (String(url).endsWith("/query")) {
        return Response.json({ version: 1, output: 14 });
      }
      return Response.json({
        version: 1,
        score: {
          accuracy: 0.75,
          exactCount: 750,
          sampleSize: 1000,
          meanError: 1.25,
          queriesUsed: 7,
          runtimeMs: 12,
          executionCost: 321,
          breakdown: {
            coreBehavior: { earned: 10, available: 10 },
            persistence: { earned: 12, available: 15 },
            concurrency: { earned: 16, available: 20 },
            failureRecovery: { earned: 14, available: 20 },
            idempotency: { earned: 15, available: 15 },
            regressionSafety: { earned: 13, available: 15 },
            performance: { earned: 5, available: 5 },
          },
        },
      });
    };
    const engine = createChallengeEngine({
      baseUrl: "https://private-engine.example/",
      apiSecret: "private-secret",
      fetch,
    });

    await expect(engine.query("participant_1", shipment)).resolves.toBe(14);
    await expect(
      engine.evaluate(
        currentChallengeVersion,
        "participant_1",
        "function calculateShipping() { return 10; }",
        7,
      ),
    ).resolves.toEqual({
      accuracy: 0.75,
      exactCount: 750,
      sampleSize: 1000,
      meanError: 1.25,
      queriesUsed: 7,
      runtimeMs: 12,
      executionCost: 321,
      breakdown: {
        coreBehavior: { earned: 10, available: 10 },
        persistence: { earned: 12, available: 15 },
        concurrency: { earned: 16, available: 20 },
        failureRecovery: { earned: 14, available: 20 },
        idempotency: { earned: 15, available: 15 },
        regressionSafety: { earned: 13, available: 15 },
        performance: { earned: 5, available: 5 },
      },
    });

    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toBe(
      "https://private-engine.example/api/v1/query",
    );
    expect(requests[0]?.init.headers).toEqual({
      authorization: "Bearer private-secret",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      version: 1,
      challengeVersion: currentChallengeVersion,
      participantKey: "participant_1",
      input: shipment,
    });

    expect(JSON.parse(String(requests[1]?.init.body))).toMatchObject({
      challengeVersion: currentChallengeVersion,
    });
  });

  test("gives official evaluations a longer abort budget than queries", async () => {
    const originalTimeout = AbortSignal.timeout;
    const timeouts: Array<number> = [];
    AbortSignal.timeout = (ms: number) => {
      timeouts.push(ms);
      return originalTimeout(ms);
    };

    try {
      const queryEngine = createChallengeEngine({
        baseUrl: "https://private-engine.example",
        apiSecret: "private-secret",
        fetch: async () => Response.json({ version: 1, output: 14 }),
      });
      await queryEngine.query("participant_1", shipment);
      expect(timeouts).toEqual([challengeEngineQueryTimeoutMs]);

      timeouts.length = 0;
      const evaluateEngine = createChallengeEngine({
        baseUrl: "https://private-engine.example",
        apiSecret: "private-secret",
        fetch: async () =>
          Response.json({
            version: 1,
            score: {
              accuracy: 1,
              exactCount: 100,
              sampleSize: 100,
              meanError: 0,
              queriesUsed: 0,
              runtimeMs: 1,
            },
          }),
      });
      await evaluateEngine.evaluate(
        brokenAgentChallengeVersion,
        "participant_1",
        "function createScheduler() { return {}; }",
        0,
      );
      expect(timeouts).toEqual([challengeEngineEvaluateTimeoutMs]);
      timeouts.length = 0;
      await evaluateEngine.evaluate(
        slowServiceChallengeVersion,
        "participant_1",
        "function createLedger() { return {}; }",
        0,
      );
      expect(timeouts).toEqual([330_000]);
      expect(slowServiceEngineEvaluateTimeoutMs).toBe(330_000);
    } finally {
      AbortSignal.timeout = originalTimeout;
    }
  });

  test("returns a typed error without leaking an invalid engine response", async () => {
    const engine = createChallengeEngine({
      baseUrl: "https://private-engine.example",
      apiSecret: "private-secret",
      fetch: async () =>
        Response.json(
          {
            version: 1,
            error: {
              code: "SOLUTION_EXECUTION_FAILED",
              message: "Define function calculateShipping(input)",
            },
          },
          { status: 422 },
        ),
    });

    await expect(
      engine.evaluate(
        brokenAgentChallengeVersion,
        "participant_1",
        "const value = 1",
        0,
      ),
    ).rejects.toEqual(
      new ChallengeEngineError(
        422,
        "SOLUTION_EXECUTION_FAILED",
        "Define function calculateShipping(input)",
      ),
    );
  });
});
