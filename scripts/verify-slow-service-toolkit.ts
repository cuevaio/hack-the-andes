import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { challengeBySlug } from "../packages/challenges-contract/src/index.ts";
import { slowServiceToolkit } from "../packages/challenges-contract/src/slow-service/toolkit.generated.ts";
import {
  slowServicePublicScenarios,
  slowServiceStarterSource,
} from "../packages/challenges-contract/src/slow-service.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp("/tmp/opencode/slow-service-v3-toolkit-proof-");
const challenge = challengeBySlug("make-it-fast");
assert.ok(challenge);
assert.equal(challenge.playable, true);
assert.equal(slowServiceToolkit.kind, "ready");
if (slowServiceToolkit.kind !== "ready") throw new Error("Toolkit unavailable");
const run = async (args: string[], cwd = directory) => {
  const child = Bun.spawn([process.execPath, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exit, stdout, stderr };
};
const initialized = await run([
  join(root, "apps/cli/src/index.ts"),
  "--output",
  "json",
  "challenge",
  "init",
  "--challenge",
  "make-it-fast",
]);
assert.equal(initialized.exit, 0, initialized.stdout + initialized.stderr);
assert.deepEqual(JSON.parse(initialized.stdout).data, {
  challenge: "make-it-fast",
  path: "slow-service",
  status: "created",
});
assert.equal(challenge.playable, true);
const exported = join(directory, "slow-service");
for (const [name, expected] of Object.entries(slowServiceToolkit.files))
  assert.equal(await readFile(join(exported, name), "utf8"), expected, name);
const install = await run(["install", "--ignore-scripts"], exported);
assert.equal(install.exit, 0, install.stderr);
const tests = await run(["test", "./.kit/ledger.test.ts"], exported);
assert.equal(tests.exit, 0, tests.stdout + tests.stderr);
assert.match(tests.stdout + tests.stderr, /6 pass/);
const probe = Bun.spawn(
  [
    process.execPath,
    "--eval",
    `
  import assert from "node:assert/strict";
  import { runLedger } from "./.kit/runner.ts";
  const { source, scenarios } = await Bun.stdin.json();
  let operations = 0;
  for (const scenario of scenarios) {
    const outcome = await runLedger({ source, setup: scenario.setup, operations: scenario.operations, checkpointBudget: 100000 });
    assert.equal(outcome.kind, "completed", JSON.stringify(outcome));
    assert.deepEqual(outcome.results, scenario.expected, scenario.name);
    operations += scenario.operations.length;
  }
  process.stdout.write(JSON.stringify({ scenarios: scenarios.length, operations, exact: true }));
`,
  ],
  {
    cwd: exported,
    stdin: new Blob([
      JSON.stringify({
        source: slowServiceStarterSource,
        scenarios: slowServicePublicScenarios,
      }),
    ]),
    stdout: "pipe",
    stderr: "pipe",
  },
);
const [exit, literalOutput, literalError] = await Promise.all([
  probe.exited,
  new Response(probe.stdout).text(),
  new Response(probe.stderr).text(),
]);
assert.equal(exit, 0, literalError);
assert.deepEqual(JSON.parse(literalOutput), {
  scenarios: 8,
  operations: 87,
  exact: true,
});
const benchmark = await run(["run", "benchmark", "ledger.js", "20"], exported);
assert.equal(benchmark.exit, 0, benchmark.stderr);
assert.match(benchmark.stdout, /"records":20,/);
assert.match(benchmark.stdout, /"records":80,/);
assert.match(benchmark.stdout, /"exact":true/);
assert.match(benchmark.stdout, /"peakRssMiB":/);
process.stdout.write(
  `${JSON.stringify({ directory, catalogOpen: true, realCliInitPassed: true, scaffoldFilesExact: Object.keys(slowServiceToolkit.files).length, participantTests: tests.stdout + tests.stderr, publicQuickJS: JSON.parse(literalOutput), reducedBenchmark: benchmark.stdout }, null, 2)}\n`,
);
