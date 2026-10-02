import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import {
  slowServiceChallengeVersion,
  slowServicePublicScenarios,
  slowServiceStarterSource,
} from "../packages/challenges-contract/src/slow-service.ts";

// Run only the approved, trusted starter. This is not a candidate sandbox or
// proof of QuickJS execution, and never reads a private oracle or reference.
let source = slowServiceStarterSource;
const approvedStarter = process.argv[2];
if (approvedStarter) {
  const path = resolve(approvedStarter);
  if (
    basename(path) !== "starter.js" ||
    basename(dirname(path)) !== slowServiceChallengeVersion
  )
    throw new Error(
      `Use only the approved ${slowServiceChallengeVersion}/starter.js`,
    );
  source = await readFile(path, "utf8");
}
if (!source)
  throw new Error(
    "Approved starter unavailable; supply its approved public path",
  );

let observations = 0;
for (const scenario of slowServicePublicScenarios) {
  const context = createContext({
    setupJSON: JSON.stringify(scenario.setup),
    operationJSON: "",
  });
  runInContext(
    `${source}\nconst ledger = createLedger(JSON.parse(setupJSON));`,
    context,
    { timeout: 1_000 },
  );
  const actual: unknown[] = [];
  for (const operation of scenario.operations) {
    context.operationJSON = JSON.stringify(operation);
    const json: unknown = runInContext(
      `(() => {
      const operation = JSON.parse(operationJSON);
      return JSON.stringify(operation.kind === "amend"
        ? ledger.amend(operation.amendment)
        : ledger.report(operation.report));
    })()`,
      context,
      { timeout: 1_000 },
    );
    if (typeof json !== "string")
      throw new Error("Starter did not return a JSON result");
    const result: unknown = JSON.parse(json);
    actual.push(result);
  }
  assert.deepEqual(actual, scenario.expected, scenario.name);
  observations += actual.length;
}
process.stdout.write(
  `${JSON.stringify({ version: slowServiceChallengeVersion, runtime: "trusted starter in host node:vm, not QuickJS", scenarios: slowServicePublicScenarios.length, observations, exact: true })}\n`,
);
