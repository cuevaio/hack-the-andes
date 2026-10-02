import type { ChallengeLocalTestResult } from "@chofex/challenges-contract";
import {
  isSlowServiceSourceWithinLimit,
  type LedgerPublicRunner,
  type LedgerResult,
  slowServicePublicScenarios,
} from "@chofex/challenges-contract/slow-service";
import { runLedger } from "@chofex/challenges-contract/slow-service/runner";
import { HttpError } from "../registration/http";

const maximumConcurrentSuites = 4;
let activeSuites = 0;
const matches = (
  actual: LedgerResult | undefined,
  expected: LedgerResult | undefined,
): boolean => {
  if (actual === undefined || expected === undefined) return false;
  if ("kind" in expected) {
    if (!("kind" in actual)) return false;
    switch (expected.kind) {
      case "committed":
        return (
          actual.kind === "committed" &&
          actual.revision === expected.revision &&
          actual.checkpoint === expected.checkpoint
        );
      case "conflict":
        return (
          actual.kind === "conflict" && actual.revision === expected.revision
        );
      case "insolvent":
        return (
          actual.kind === "insolvent" &&
          actual.account === expected.account &&
          actual.at === expected.at &&
          actual.balance === expected.balance
        );
      default: {
        const exhaustive: never = expected;
        return exhaustive;
      }
    }
  }
  if ("kind" in actual) return false;
  return (
    actual.opening === expected.opening &&
    actual.net === expected.net &&
    actual.closing === expected.closing &&
    actual.entries === expected.entries &&
    actual.minimumBalance === expected.minimumBalance &&
    actual.debits === expected.debits &&
    actual.debitAmountAtPercentile === expected.debitAmountAtPercentile
  );
};

export const runSlowServicePublicTests = async (
  source: string,
  runner: LedgerPublicRunner | undefined = runLedger,
): Promise<ChallengeLocalTestResult> => {
  if (!isSlowServiceSourceWithinLimit(source))
    throw new HttpError(
      422,
      "INVALID_SOURCE",
      "El source debe tener entre 1 y 32,768 bytes UTF-8.",
    );
  if (!runner)
    throw new HttpError(
      503,
      "SLOW_SERVICE_TOOLKIT_NOT_READY",
      "El runner público de Slow Service v3 todavía no está listo. El challenge sigue cerrado.",
      true,
    );
  if (activeSuites >= maximumConcurrentSuites)
    throw new HttpError(
      503,
      "SOLUTION_RUNNER_BUSY",
      "El runner está ocupado. Intenta de nuevo en unos segundos.",
      true,
    );
  activeSuites += 1;
  let passed = 0;
  const mismatches: ChallengeLocalTestResult["mismatches"][number][] = [];
  try {
    for (const [index, scenario] of slowServicePublicScenarios.entries()) {
      const outcome = await runner({
        source,
        setup: scenario.setup,
        operations: scenario.operations,
        checkpointBudget: 10_000,
      });
      if (outcome.kind !== "completed") {
        mismatches.push({
          sequence: index + 1,
          expected: "pass",
          actual: `${scenario.name}: ${outcome.reason}`,
        });
        continue;
      }
      const mismatch = scenario.expected.findIndex(
        (expected, operationIndex) =>
          !matches(outcome.results[operationIndex], expected),
      );
      const mismatchIndex = mismatch < 0 ? scenario.expected.length : mismatch;
      if (mismatch < 0 && outcome.results.length === scenario.expected.length)
        passed += 1;
      else
        mismatches.push({
          sequence: index + 1,
          expected:
            scenario.expected[mismatchIndex] ??
            `${scenario.expected.length} respuestas`,
          actual: {
            scenario: scenario.name,
            operation: mismatchIndex + 1,
            result:
              outcome.results[mismatchIndex] ??
              `${outcome.results.length} respuestas`,
          },
        });
    }
    return {
      kind: "slow_service",
      matchedObservations: passed,
      observationCount: slowServicePublicScenarios.length,
      accuracy: passed / slowServicePublicScenarios.length,
      meanError:
        (slowServicePublicScenarios.length - passed) /
        slowServicePublicScenarios.length,
      mismatches,
    };
  } finally {
    activeSuites -= 1;
  }
};
