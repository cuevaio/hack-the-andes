import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  slowServiceAcceptedLegEditLimit,
  slowServiceActiveJournalLimit,
  slowServiceChallengeVersion,
  slowServiceMemoryLimit,
  slowServicePublicPerformance,
  slowServicePublicScenarios,
} from "@chofex/challenges-contract/slow-service";
import { slowServiceToolkit } from "@chofex/challenges-contract/slow-service/toolkit";

test("the current contract is v3 and its public examples use setup, amendments and exact percentile reports", () => {
  expect(slowServiceChallengeVersion).toBe("slow-service-v3");
  expect(slowServiceToolkit.version).toBe(slowServiceChallengeVersion);
  expect(slowServicePublicScenarios).toHaveLength(8);
  for (const scenario of slowServicePublicScenarios) {
    expect(scenario.setup.accounts.length).toBeGreaterThanOrEqual(2);
    expect(scenario.setup.accounts.length).toBeLessThanOrEqual(1_024);
    expect(
      scenario.setup.accounts.every(
        ({ id }) => id.length >= 1 && id.length <= 64,
      ),
    ).toBe(true);
    expect(scenario.operations.length).toBe(scenario.expected.length);
    expect(
      scenario.setup.accounts.every(
        ({ opening }) =>
          Number.isSafeInteger(opening) &&
          opening >= 0 &&
          opening <= 1_000_000_000_000,
      ),
    ).toBe(true);
    let checkpoint = 0;
    for (const [index, operation] of scenario.operations.entries()) {
      if (operation.kind === "report") {
        expect(operation.report.asOf).toBeLessThanOrEqual(checkpoint);
        expect(operation.report.from).toBeLessThanOrEqual(operation.report.to);
        expect(operation.report.to).toBeLessThanOrEqual(2_147_483_648);
        expect(Number.isInteger(operation.report.percentile)).toBe(true);
        expect(operation.report.percentile).toBeGreaterThanOrEqual(1);
        expect(operation.report.percentile).toBeLessThanOrEqual(100);
        const result = scenario.expected[index];
        if (!result || "kind" in result)
          throw new Error("missing literal report");
        expect(Object.keys(result).sort()).toEqual([
          "closing",
          "debitAmountAtPercentile",
          "debits",
          "entries",
          "minimumBalance",
          "net",
          "opening",
        ]);
        expect(Number.isInteger(result.debits)).toBe(true);
        expect(result.debits).toBeGreaterThanOrEqual(0);
        expect(result.debits).toBeLessThanOrEqual(result.entries);
        if (result.debits === 0)
          expect(result.debitAmountAtPercentile).toBeNull();
        else {
          expect(Number.isInteger(result.debitAmountAtPercentile)).toBe(true);
          expect(result.debitAmountAtPercentile).toBeGreaterThanOrEqual(1);
          expect(result.debitAmountAtPercentile).toBeLessThanOrEqual(
            1_000_000_000,
          );
        }
      } else {
        const entry = operation.amendment.entry;
        if (entry) {
          expect(entry.legs.length).toBeGreaterThanOrEqual(2);
          expect(entry.legs.length).toBeLessThanOrEqual(8);
          expect(new Set(entry.legs.map((leg) => leg.account)).size).toBe(
            entry.legs.length,
          );
          expect(entry.legs.reduce((sum, leg) => sum + leg.delta, 0)).toBe(0);
          expect(entry.at).toBeLessThanOrEqual(2_147_483_647);
          expect(
            entry.legs.every(
              ({ account, delta }) =>
                scenario.setup.accounts.some(({ id }) => id === account) &&
                Number.isSafeInteger(delta) &&
                delta !== 0 &&
                Math.abs(delta) <= 1_000_000_000,
            ),
          ).toBe(true);
        }
        const expected = scenario.expected[index];
        if (expected && "kind" in expected && expected.kind === "committed") {
          checkpoint += 1;
          expect(expected.checkpoint).toBe(checkpoint);
        }
      }
    }
  }
});

test("the calibrated v3 bounds match the approved release contract", () => {
  expect(slowServiceActiveJournalLimit).toBe(24_000);
  expect(slowServiceAcceptedLegEditLimit).toBe(72_000);
  expect(slowServiceMemoryLimit).toBe(640 * 1_024 * 1_024);
  expect(slowServicePublicPerformance).toEqual({
    kind: "calibrated",
    smallJournalCount: 6_000,
    largeJournalCount: 24_000,
    phaseOperations: 1_024,
    tiers: [
      { points: 10, normalizedGrowth: 1.8, relativeCpu: 3 },
      { points: 6, normalizedGrowth: 3.5, relativeCpu: 6 },
      { points: 3, normalizedGrowth: 6, relativeCpu: 12 },
    ],
  });
});

test("public nearest-rank literals preserve credits, cohorts, multiplicity and history", () => {
  const nearest = slowServicePublicScenarios[6];
  const history = slowServicePublicScenarios[7];
  if (!nearest || !history) throw new Error("missing percentile examples");
  expect(nearest.expected[4]).toEqual({
    opening: 1_000,
    net: -200,
    closing: 800,
    entries: 3,
    minimumBalance: 800,
    debits: 2,
    debitAmountAtPercentile: 100,
  });
  expect(nearest.expected[5]).toEqual({
    opening: 1_000,
    net: -200,
    closing: 800,
    entries: 3,
    minimumBalance: 800,
    debits: 2,
    debitAmountAtPercentile: 300,
  });
  expect(nearest.expected[10]).toEqual({
    opening: 1_000,
    net: -300,
    closing: 700,
    entries: 4,
    minimumBalance: 700,
    debits: 3,
    debitAmountAtPercentile: 100,
  });
  expect(nearest.expected[11]).toEqual({
    opening: 1_000,
    net: -300,
    closing: 700,
    entries: 4,
    minimumBalance: 700,
    debits: 3,
    debitAmountAtPercentile: 300,
  });
  expect(nearest.expected[2]).toEqual({
    opening: 0,
    net: 400,
    closing: 400,
    entries: 2,
    minimumBalance: 0,
    debits: 0,
    debitAmountAtPercentile: null,
  });
  expect(nearest.expected[8]).toEqual({
    opening: 800,
    net: 0,
    closing: 800,
    entries: 0,
    minimumBalance: 800,
    debits: 0,
    debitAmountAtPercentile: null,
  });
  expect(history.expected[8]).toEqual({
    kind: "insolvent",
    account: "caja",
    at: 8,
    balance: -100,
  });
  expect(history.expected[9]).toEqual({
    opening: 1_000,
    net: -300,
    closing: 700,
    entries: 2,
    minimumBalance: 700,
    debits: 2,
    debitAmountAtPercentile: 200,
  });
  expect(history.expected[10]).toEqual({ kind: "conflict", revision: 2 });
  expect(history.expected[13]).toEqual({
    opening: 1_000,
    net: -50,
    closing: 950,
    entries: 2,
    minimumBalance: 900,
    debits: 1,
    debitAmountAtPercentile: 100,
  });
  expect(history.expected[14]).toEqual({
    opening: 0,
    net: 50,
    closing: 50,
    entries: 2,
    minimumBalance: 0,
    debits: 1,
    debitAmountAtPercentile: 50,
  });
  expect(history.expected[18]).toEqual({
    opening: 1_000,
    net: 0,
    closing: 1_000,
    entries: 0,
    minimumBalance: 1_000,
    debits: 0,
    debitAmountAtPercentile: null,
  });
  expect(history.expected[19]).toEqual({
    opening: 1_000,
    net: -300,
    closing: 700,
    entries: 2,
    minimumBalance: 700,
    debits: 2,
    debitAmountAtPercentile: 200,
  });
});

test("the v3 sync guard refuses a previous-version directory before reading artifacts", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      new URL("../../../scripts/sync-slow-service-toolkit.ts", import.meta.url)
        .pathname,
      "/tmp/opencode/slow-service-v2",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [code, output] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
  ]);
  expect(code).toBe(1);
  expect(output).toContain(
    `approved src/${slowServiceChallengeVersion} whitelist`,
  );
});

test("the approved participant toolkit installs and runs its real QuickJS tests and benchmark", async () => {
  if (slowServiceToolkit.kind !== "ready")
    throw new Error("approved toolkit missing");
  const directory = await mkdtemp("/tmp/opencode/slow-service-artifact-");
  try {
    await mkdir(join(directory, ".kit"));
    await Promise.all(
      Object.entries(slowServiceToolkit.files).map(([name, content]) =>
        writeFile(join(directory, name), content),
      ),
    );
    const install = Bun.spawn(
      [process.execPath, "install", "--ignore-scripts"],
      { cwd: directory, stdout: "pipe", stderr: "pipe" },
    );
    const [installed, installOutput] = await Promise.all([
      install.exited,
      new Response(install.stderr).text(),
    ]);
    expect({ installed, failed: installOutput.includes("error:") }).toEqual({
      installed: 0,
      failed: false,
    });
    const processResult = Bun.spawn(
      [process.execPath, "test", "./.kit/ledger.test.ts"],
      { cwd: directory, stdout: "pipe", stderr: "pipe" },
    );
    const [exit, stdout, stderr] = await Promise.all([
      processResult.exited,
      new Response(processResult.stdout).text(),
      new Response(processResult.stderr).text(),
    ]);
    expect({ exit, output: stdout + stderr }).toMatchObject({ exit: 0 });
    const benchmark = Bun.spawn(
      [process.execPath, "run", "benchmark", "ledger.js", "20"],
      { cwd: directory, stdout: "pipe", stderr: "pipe" },
    );
    const [benchmarkExit, benchmarkOutput] = await Promise.all([
      benchmark.exited,
      new Response(benchmark.stdout).text(),
    ]);
    expect(benchmarkExit).toBe(0);
    expect(benchmarkOutput).toContain('"peakRssMiB":');
    expect(benchmarkOutput).toContain('"records":20,');
    expect(benchmarkOutput).toContain('"records":80,');
    expect(benchmarkOutput).toContain('"exact":true');
    const invalidHistory = Bun.spawn(
      [
        process.execPath,
        "run",
        "benchmark",
        "ledger.js",
        "100",
        "--max-history",
      ],
      { cwd: directory, stdout: "pipe", stderr: "pipe" },
    );
    const [historyExit, historyError] = await Promise.all([
      invalidHistory.exited,
      new Response(invalidHistory.stderr).text(),
    ]);
    expect(historyExit).toBe(1);
    expect(historyError).toContain(
      `--max-history requiere ${slowServicePublicPerformance.smallJournalCount}`,
    );
    const invalidNegative = Bun.spawn(
      [
        process.execPath,
        "run",
        "benchmark",
        "ledger.js",
        "100",
        "--negative-heavy",
      ],
      { cwd: directory, stdout: "pipe", stderr: "pipe" },
    );
    const [negativeExit, negativeError] = await Promise.all([
      invalidNegative.exited,
      new Response(invalidNegative.stderr).text(),
    ]);
    expect(negativeExit).toBe(1);
    expect(negativeError).toContain("--negative-heavy requiere --max-history");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
