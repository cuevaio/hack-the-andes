import { readFile } from "node:fs/promises";
import { slowServicePublicScenarios } from "../packages/challenges-contract/src/slow-service";

// One-time, public-only migration. Emit a patch; never read private fixtures.
// These literal pairs were reviewed against the existing six public examples.
const debitFields: ReadonlyArray<
  ReadonlyArray<readonly [number, number | null]>
> = [
  [
    [0, null],
    [0, null],
    [0, null],
    [0, null],
    [0, null],
  ],
  [
    [0, null],
    [0, null],
  ],
  [
    [1, 120],
    [1, 300],
    [0, null],
    [1, 120],
    [1, 120],
  ],
  [
    [1, 100],
    [1, 60],
    [0, null],
    [1, 100],
    [0, null],
  ],
  [[1, 40]],
  [
    [0, null],
    [0, null],
    [0, null],
    [0, null],
    [0, null],
    [0, null],
    [0, null],
  ],
];

const path = "packages/challenges-contract/src/slow-service.ts";
const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
if (process.argv.includes("--verify")) {
  let reports = 0;
  for (const [scenarioIndex, fields] of debitFields.entries()) {
    const scenario = slowServicePublicScenarios[scenarioIndex];
    if (!scenario) throw new Error("Missing original public scenario");
    let reportIndex = 0;
    for (const [index, result] of scenario.expected.entries()) {
      if ("kind" in result) continue;
      const pair = fields[reportIndex++];
      const operation = scenario.operations[index];
      if (
        !pair ||
        result.debits !== pair[0] ||
        result.debitAmountAtPercentile !== pair[1] ||
        operation?.kind !== "report" ||
        operation.report.percentile !== 50
      )
        throw new Error(
          `Changed reviewed public report: ${scenario.name}, ${index}`,
        );
      reports += 1;
    }
    if (reportIndex !== fields.length)
      throw new Error("Changed original report count");
  }
  process.stdout.write(
    `${JSON.stringify({ preservedScenarios: debitFields.length, reviewedReports: reports })}\n`,
  );
  process.exit(0);
}
if (source.includes("debitAmountAtPercentile"))
  throw new Error(
    "Public fixtures already migrated; refusing to overwrite them",
  );
const expectedBlocks = [
  ...source.matchAll(/ {4}expected: \[\n[\s\S]*?\n {4}\],/g),
];
if (slowServicePublicScenarios.length !== 6 || expectedBlocks.length !== 6)
  throw new Error("Review changed public scenarios before migrating");

const hunks: { readonly offset: number; readonly patch: string }[] = [];
let offset = 0;
for (const line of source.split("\n")) {
  const lineOffset = offset;
  offset += line.length + 1;
  if (!line.includes("asOf:")) continue;
  const next = line.replace(/asOf: (\d+),?/g, "asOf: $1, percentile: 50,");
  hunks.push({ offset: lineOffset, patch: `@@\n-${line}\n+${next}` });
}
for (const [scenarioIndex, scenario] of slowServicePublicScenarios.entries()) {
  const fields = debitFields[scenarioIndex];
  const block = expectedBlocks[scenarioIndex]?.[0];
  if (!fields || !block) throw new Error("Missing reviewed scenario");
  let reportIndex = 0;
  const expected = scenario.expected.map((result) => {
    if ("kind" in result) return result;
    const pair = fields[reportIndex++];
    if (!pair) throw new Error(`Missing debit fields in ${scenario.name}`);
    return { ...result, debits: pair[0], debitAmountAtPercentile: pair[1] };
  });
  if (reportIndex !== fields.length)
    throw new Error(
      `Unexpected report count in ${scenario.name}: ${reportIndex}`,
    );
  const next = `    expected: [\n${expected.map((result) => `      ${JSON.stringify(result)},`).join("\n")}\n    ],`;
  hunks.push({
    offset: expectedBlocks[scenarioIndex]?.index ?? 0,
    patch: `@@\n${block
      .split("\n")
      .map((line) => `-${line}`)
      .join("\n")}\n${next
      .split("\n")
      .map((line) => `+${line}`)
      .join("\n")}`,
  });
}
process.stdout.write(
  `*** Begin Patch\n*** Update File: ${new URL(`../${path}`, import.meta.url).pathname}\n${hunks
    .sort((left, right) => left.offset - right.offset)
    .map(({ patch }) => patch)
    .join("\n")}\n*** End Patch\n`,
);
