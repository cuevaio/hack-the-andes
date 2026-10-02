import { expect, test } from "bun:test";
import {
  type BalanceReport,
  type LedgerPublicRunner,
  slowServicePublicScenarios,
  slowServiceStarterSource,
} from "@chofex/challenges-contract/slow-service";
import { runLedger } from "@chofex/challenges-contract/slow-service/runner";
import { runSlowServicePublicTests } from "./slow-service-public";

// These injected outcomes test the public adapter, not candidate execution.
// Candidate execution is covered separately by the real child-guest tests below.
const completedFixtureRunner: LedgerPublicRunner = async ({ setup }) => {
  const scenario = slowServicePublicScenarios.find(
    (scenario) => scenario.setup === setup,
  );
  if (!scenario) throw new Error("unexpected setup");
  return { kind: "completed", results: scenario.expected };
};

test("invalid initialization gets no credit and releases the public suite slot", async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await runSlowServicePublicTests(
      "function createLedger() {}",
    );
    expect(result.accuracy).toBe(0);
    expect(result.mismatches).toHaveLength(slowServicePublicScenarios.length);
    expect(
      result.mismatches.every(
        ({ actual }) =>
          typeof actual === "string" && actual.endsWith(": execution"),
      ),
    ).toBe(true);
  }
});

test("valid-shaped but wrong zero answers complete and receive zero public credit", async () => {
  const source = `function createLedger() { return {
    amend() { return { kind: "committed", revision: 0, checkpoint: 0 }; },
    report() { return { opening: 0, net: 0, closing: 0, entries: 0, minimumBalance: 0, debits: 0, debitAmountAtPercentile: null }; }
  }; }`;
  const scenario = slowServicePublicScenarios[0];
  if (!scenario) throw new Error("missing public scenario");
  const outcome = await runLedger({
    source,
    setup: scenario.setup,
    operations: scenario.operations,
    checkpointBudget: 10_000,
  });
  expect(outcome.kind).toBe("completed");
  const result = await runSlowServicePublicTests(source);
  expect(result.accuracy).toBe(0);
  expect(result.matchedObservations).toBe(0);
  expect(result.mismatches).toHaveLength(slowServicePublicScenarios.length);
});

test("each v3 public scenario receives independent factory setup separately from online operations", async () => {
  const calls: Parameters<LedgerPublicRunner>[0][] = [];
  const runner: LedgerPublicRunner = async (input) => {
    calls.push(input);
    return completedFixtureRunner(input);
  };
  expect(
    await runSlowServicePublicTests("function createLedger(setup) {}", runner),
  ).toEqual({
    kind: "slow_service",
    matchedObservations: 8,
    observationCount: 8,
    accuracy: 1,
    meanError: 0,
    mismatches: [],
  });
  expect(calls).toHaveLength(slowServicePublicScenarios.length);
  expect(calls[0]?.setup).toEqual({
    accounts: [
      { id: "caja", opening: 1_000 },
      { id: "tienda", opening: 0 },
    ],
  });
  expect(calls[1]?.setup).toEqual({
    accounts: [
      { id: "a", opening: 100 },
      { id: "b", opening: 0 },
    ],
  });
  expect(calls[0]?.operations[0]).toEqual({
    kind: "report",
    report: {
      account: "caja",
      from: 0,
      to: 2_147_483_648,
      asOf: 0,
      percentile: 50,
    },
  });
  expect(
    calls.every((call) =>
      call.operations.every(
        (operation) =>
          operation.kind === "amend" || operation.kind === "report",
      ),
    ),
  ).toBe(true);
});

test("the adapter compares amendment revisions and accounting fields exactly", async () => {
  const runner: LedgerPublicRunner = async (input) => {
    const outcome = await completedFixtureRunner(input);
    if (outcome.kind !== "completed") return outcome;
    if (input.setup === slowServicePublicScenarios[0]?.setup)
      return {
        kind: "completed",
        results: outcome.results.map((result, index) =>
          index === 2
            ? { kind: "committed", revision: 2, checkpoint: 1 }
            : result,
        ),
      };
    if (input.setup === slowServicePublicScenarios[2]?.setup)
      return {
        kind: "completed",
        results: outcome.results.map((result, index) =>
          index === 9
            ? {
                opening: 120,
                net: -120,
                closing: 0,
                entries: 1,
                minimumBalance: 120,
                debits: 1,
                debitAmountAtPercentile: 120,
              }
            : result,
        ),
      };
    return outcome;
  };
  const result = await runSlowServicePublicTests(
    "function createLedger(setup) {}",
    runner,
  );
  expect(result.matchedObservations).toBe(
    slowServicePublicScenarios.length - 2,
  );
  expect(result.mismatches[0]).toEqual({
    sequence: 1,
    expected: { kind: "committed", revision: 1, checkpoint: 1 },
    actual: {
      scenario: "setup, checkpoint cero e intervalos vacíos",
      operation: 3,
      result: { kind: "committed", revision: 2, checkpoint: 1 },
    },
  });
  expect(result.mismatches[1]?.expected).toEqual({
    opening: 120,
    net: -120,
    closing: 0,
    entries: 1,
    minimumBalance: 0,
    debits: 1,
    debitAmountAtPercentile: 120,
  });
});

test("each of the seven report fields can independently reject an otherwise correct response", async () => {
  const scenario = slowServicePublicScenarios[6];
  if (!scenario) throw new Error("missing percentile scenario");
  const mutations: ReadonlyArray<(report: BalanceReport) => BalanceReport> = [
    (report) => ({ ...report, opening: report.opening + 1 }),
    (report) => ({ ...report, net: report.net + 1 }),
    (report) => ({ ...report, closing: report.closing + 1 }),
    (report) => ({ ...report, entries: report.entries + 1 }),
    (report) => ({ ...report, minimumBalance: report.minimumBalance + 1 }),
    (report) => ({ ...report, debits: report.debits - 1 }),
    (report) => ({ ...report, debitAmountAtPercentile: 200 }),
  ];
  for (const mutate of mutations) {
    const runner: LedgerPublicRunner = async (input) => {
      const outcome = await completedFixtureRunner(input);
      if (outcome.kind !== "completed" || input.setup !== scenario.setup)
        return outcome;
      return {
        kind: "completed",
        results: outcome.results.map((result, index) =>
          index === 4 && !("kind" in result) ? mutate(result) : result,
        ),
      };
    };
    const result = await runSlowServicePublicTests(
      "function createLedger() {}",
      runner,
    );
    expect(result.accuracy).toBe(7 / 8);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]?.sequence).toBe(7);
    expect(result.mismatches[0]?.expected).toEqual({
      opening: 1_000,
      net: -200,
      closing: 800,
      entries: 3,
      minimumBalance: 800,
      debits: 2,
      debitAmountAtPercentile: 100,
    });
  }
});

test("a zero-debit report requires null rather than a numeric zero percentile", async () => {
  const runner: LedgerPublicRunner = async (input) => {
    const outcome = await completedFixtureRunner(input);
    if (
      outcome.kind !== "completed" ||
      input.setup !== slowServicePublicScenarios[0]?.setup
    )
      return outcome;
    return {
      kind: "completed",
      results: outcome.results.map((result, index) =>
        index === 0 && !("kind" in result)
          ? { ...result, debitAmountAtPercentile: 0 }
          : result,
      ),
    };
  };
  const result = await runSlowServicePublicTests(
    "function createLedger() {}",
    runner,
  );
  expect(result.matchedObservations).toBe(7);
  expect(result.mismatches[0]?.expected).toEqual({
    opening: 1_000,
    net: 0,
    closing: 1_000,
    entries: 0,
    minimumBalance: 1_000,
    debits: 0,
    debitAmountAtPercentile: null,
  });
});

test("failed child outcomes and missing results never receive correctness credit", async () => {
  for (const runner of [
    async () => ({ kind: "failed", reason: "memory" }),
    async () => ({ kind: "completed", results: [] }),
  ] satisfies LedgerPublicRunner[]) {
    const result = await runSlowServicePublicTests(
      "function createLedger(setup) {}",
      runner,
    );
    expect(result.accuracy).toBe(0);
    expect(result.mismatches).toHaveLength(slowServicePublicScenarios.length);
  }
});

test("source limits remain exactly 32 KiB UTF-8 before runner availability is checked", async () => {
  for (const source of ["", " ".repeat(32_769), "é".repeat(16_385)])
    await expect(
      runSlowServicePublicTests(source, completedFixtureRunner),
    ).rejects.toThrow("32,768");
  expect(
    (
      await runSlowServicePublicTests(
        "é".repeat(16_384),
        completedFixtureRunner,
      )
    ).accuracy,
  ).toBe(1);
});

test("the approved v3 starter passes the real child QuickJS suite", async () => {
  if (!slowServiceStarterSource)
    throw new Error("approved runner and starter missing");
  expect(
    (await runSlowServicePublicTests(slowServiceStarterSource)).accuracy,
  ).toBe(1);
});
