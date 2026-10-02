import assert from "node:assert/strict";
import * as childProcess from "node:child_process";
import { readdir, readFile, realpath } from "node:fs/promises";
import * as nativeModule from "node:module";
import * as nativePath from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import { slowServiceToolkit } from "../packages/challenges-contract/src/slow-service/toolkit.generated.ts";
import {
  slowServiceChallengeVersion,
  slowServicePublicScenarios,
  slowServiceStarterSource,
} from "../packages/challenges-contract/src/slow-service.ts";

assert.equal(
  slowServiceToolkit.kind,
  "ready",
  `${slowServiceChallengeVersion} toolkit is pending parent approval; there is no runnable build gate yet`,
);
assert.equal(
  typeof slowServiceStarterSource,
  "string",
  `Missing approved ${slowServiceChallengeVersion} starter`,
);

const root = fileURLToPath(new URL("../", import.meta.url));
const standalone = nativePath.join(root, "apps/web/.next/standalone");
const chunks = nativePath.join(standalone, "apps/web/.next/server/chunks");
const candidates = [];
for (const name of await readdir(chunks)) {
  if (!name.endsWith(".js")) continue;
  const source = await readFile(nativePath.join(chunks, name), "utf8");
  if (source.includes("slow-service-runner")) candidates.push({ name, source });
}
assert.equal(
  candidates.length,
  1,
  "Expected exactly one compiled Slow Service runner chunk",
);
const [{ name, source }] = candidates;
const { parse } = nativeModule.createRequire(import.meta.url)(
  "next/dist/compiled/acorn/acorn.js",
);
const syntax = parse(source, { ecmaVersion: "latest" });
const text = (node) => source.slice(node.start, node.end);
let body;
function findBody(node) {
  if (
    node.type === "ArrowFunctionExpression" &&
    node.body.type === "BlockStatement" &&
    text(node.body).includes("slow-service-runner")
  ) {
    body = node.body;
    return;
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) if (child?.type) findBody(child);
    } else if (value?.type) findBody(value);
  }
}
findBody(syntax);
assert.ok(body, "Missing compiled module body");
const declarations = body.body;
const start = declarations.find(
  (node) =>
    node.type === "VariableDeclaration" &&
    text(node).includes('"execFileSync"'),
);
const runner = declarations.find(
  (node) =>
    node.type === "FunctionDeclaration" &&
    text(node).includes("checkpointBudget") &&
    text(node).includes("measurementStartOperation"),
);
assert.ok(
  start && runner?.id,
  "Compiled runner shape changed; inspect the new chunk",
);
// Execute the compiled declarations unchanged. Supply only their native imports
// and export the otherwise tree-shaken internal function for this build probe.
const compiled = source.slice(start.start, runner.end);
const childAlias = /Reflect\.get\((\w+),"execFileSync"\)/.exec(compiled)?.[1];
const moduleAlias = /\(0,(\w+)\.createRequire\)/.exec(compiled)?.[1];
const pathAlias = /\(0,(\w+)\.join\)/.exec(compiled)?.[1];
assert.ok(
  childAlias && moduleAlias && pathAlias,
  "Compiled native imports changed",
);
const caches = declarations
  .filter((node) => node.type === "VariableDeclaration")
  .flatMap((node) => node.declarations)
  .filter((node) => !node.init)
  .map((node) => node.id.name);
assert.ok(
  caches.length > 0 && caches.every(Boolean),
  "Compiled runner cache declarations changed",
);
const factory = runInThisContext(
  `(function(nativeChildProcess, nativeModule, nativePath) {
  let ${caches.join(",")};
  const ${childAlias} = nativeChildProcess, ${moduleAlias} = nativeModule, ${pathAlias} = nativePath;
  ${compiled}
  return ${runner.id.name};
})`,
  { filename: name },
);
const previousDirectory = process.cwd();
try {
  process.chdir(nativePath.join(standalone, "apps/web"));
  const resolved = nativeModule
    .createRequire(nativePath.join(process.cwd(), "package.json"))
    .resolve("quickjs-emscripten");
  assert.ok(
    (await realpath(resolved)).startsWith(`${standalone}/`),
    "QuickJS must come from the packaged standalone output",
  );
  let activeChildren = 0;
  let closedChildren = 0;
  const nativeChildProcess = {
    ...childProcess,
    spawn(...args) {
      const child = childProcess.spawn(...args);
      activeChildren += 1;
      child.once("close", () => {
        activeChildren -= 1;
        closedChildren += 1;
      });
      return child;
    },
  };
  const compiledRunLedger = factory(
    nativeChildProcess,
    nativeModule,
    nativePath,
  );
  const runLedger = async (input) => {
    const outcome = await compiledRunLedger(input);
    assert.equal(activeChildren, 0, "Runner returned before its child closed");
    return outcome;
  };
  const failures = [];
  for (const scenario of slowServicePublicScenarios) {
    const outcome = await runLedger({
      source: slowServiceStarterSource,
      setup: scenario.setup,
      operations: scenario.operations,
      checkpointBudget: 10_000,
    });
    assert.equal(
      outcome.kind,
      "completed",
      `${scenario.name}: ${JSON.stringify(outcome)}`,
    );
    assert.deepEqual(outcome.results, scenario.expected);
    assert.ok(
      Number.isSafeInteger(outcome.peakRssBytes) && outcome.peakRssBytes > 0,
    );
  }
  const scenario = slowServicePublicScenarios[0];
  assert.ok(scenario, "Missing public scenario");
  for (const probe of [
    { reason: "execution", source: "function createLedger() {}" },
    { reason: "budget", source: slowServiceStarterSource, checkpointBudget: 0 },
    {
      reason: "timeout",
      source: "function createLedger() { for (;;) {} }",
      timeoutMs: 50,
      checkpointBudget: 1_000_000_000,
    },
    {
      reason: "memory",
      source:
        "function createLedger() { const arrays = []; for (;;) arrays.push(new Uint8Array(16 * 1024 * 1024).fill(1)); }",
    },
  ]) {
    const outcome = await runLedger({
      source: probe.source,
      setup: scenario.setup,
      operations: [],
      checkpointBudget: probe.checkpointBudget ?? 10_000,
      timeoutMs: probe.timeoutMs,
    });
    assert.equal(outcome.kind, "failed", JSON.stringify(outcome));
    assert.equal(outcome.reason, probe.reason, JSON.stringify(outcome));
    failures.push(outcome.reason);
  }
  const zero = await runLedger({
    source: `function createLedger() { return {
      amend() { return { kind: "committed", revision: 0, checkpoint: 0 }; },
      report() { return { opening: 0, net: 0, closing: 0, entries: 0, minimumBalance: 0, debits: 0, debitAmountAtPercentile: null }; }
    }; }`,
    setup: scenario.setup,
    operations: scenario.operations,
    checkpointBudget: 10_000,
  });
  assert.equal(zero.kind, "completed", JSON.stringify(zero));
  assert.notDeepEqual(zero.results, scenario.expected);
  const recovery = await runLedger({
    source: slowServiceStarterSource,
    setup: scenario.setup,
    operations: scenario.operations,
    checkpointBudget: 10_000,
  });
  assert.equal(recovery.kind, "completed", JSON.stringify(recovery));
  assert.deepEqual(recovery.results, scenario.expected);
  const badOutput = await runLedger({
    source: `function createLedger() { return {
      amend() { return { kind: "committed", revision: 1, checkpoint: 1 }; },
      report() { return { opening: 0, net: 0, closing: 0, entries: 0, minimumBalance: 0, debits: 0, debitAmountAtPercentile: 0 }; }
    }; }`,
    setup: scenario.setup,
    operations: [scenario.operations[0]],
    checkpointBudget: 10_000,
  });
  assert.equal(badOutput.kind, "failed", JSON.stringify(badOutput));
  assert.equal(badOutput.reason, "execution", JSON.stringify(badOutput));
  const health = await runLedger({
    source: slowServiceStarterSource,
    setup: scenario.setup,
    operations: [scenario.operations[0]],
    checkpointBudget: 10_000,
  });
  assert.equal(health.kind, "completed", JSON.stringify(health));
  assert.deepEqual(health.results, [scenario.expected[0]]);
  console.log(
    JSON.stringify({
      compiledChunk: name,
      quickJS: resolved,
      passed: slowServicePublicScenarios.length,
      failures,
      validWrongOutputCompleted: true,
      recoveryPassed: true,
      invalidOutputRejected: true,
      publicHealthPassed: true,
      childClosedBeforeEveryReturn: true,
      closedChildren,
    }),
  );
} finally {
  process.chdir(previousDirectory);
}
