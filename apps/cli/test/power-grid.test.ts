import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { powerGridExample } from "@chofex/challenges-contract/power-grid";
import { Effect } from "effect";
import {
  challengeEvaluationInput,
  powerReadingInput,
} from "../src/challenge-input.js";
import {
  challengeTestText,
  notebookCsvText,
  notebookTableText,
} from "../src/challenge-output.js";
import { createChallengeScaffold } from "../src/challenge-scaffold.js";

test("scaffolds electricity files without overwriting participant work", async () => {
  const directory = await mkdtemp(join(tmpdir(), "power-grid-test-"));
  const original = process.cwd();
  try {
    process.chdir(directory);
    expect(
      await Effect.runPromise(createChallengeScaffold("power-grid")),
    ).toMatchObject({ path: "power-grid", status: "created" });
    expect(JSON.parse(await readFile("power-grid/input.json", "utf8"))).toEqual(
      powerGridExample,
    );
    expect(await readFile("power-grid/bill.js", "utf8")).toContain(
      "function calculateBill(input)",
    );
    await writeFile("power-grid/bill.js", "participant work");
    expect(
      await Effect.runPromise(createChallengeScaffold("power-grid")),
    ).toMatchObject({ status: "exists" });
    expect(await readFile("power-grid/bill.js", "utf8")).toBe(
      "participant work",
    );
  } finally {
    process.chdir(original);
    await rm(directory, { recursive: true, force: true });
  }
});

test("reads an electricity query and accepts a solution without a review", async () => {
  const directory = await mkdtemp(join(tmpdir(), "power-grid-input-"));
  try {
    const input = join(directory, "input.json");
    const source = join(directory, "bill.js");
    await writeFile(input, JSON.stringify(powerGridExample));
    await writeFile(source, "function calculateBill(input) { return 0; }");
    expect(await Effect.runPromise(powerReadingInput(input))).toEqual(
      powerGridExample,
    );
    expect(
      await Effect.runPromise(
        challengeEvaluationInput(source, undefined, "power-grid"),
      ),
    ).toEqual({
      kind: "javascript_source",
      source: "function calculateBill(input) { return 0; }",
    });
    await writeFile(
      input,
      JSON.stringify({ ...powerGridExample, demandKw: -1 }),
    );
    await expect(Effect.runPromise(powerReadingInput(input))).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("electricity notebooks and test advice use electricity fields and commands", () => {
  const observations = [
    {
      sequence: 1,
      input: powerGridExample,
      output: 420,
      createdAt: "2026-10-09T05:00:00Z",
    },
  ];
  expect(notebookCsvText(observations, "power-grid")).toBe(
    "sequence,consumptionKwh,demandKw,hour,solar,business,output\n1,100,5,12,false,false,420",
  );
  expect(notebookTableText(observations, false, "power-grid")).toContain(
    "--challenge power-grid --source ./bill.js",
  );
  expect(
    challengeTestText(
      {
        accuracy: 1,
        matchedObservations: 1,
        observationCount: 1,
        meanError: 0,
        mismatches: [],
      },
      "power-grid",
    ),
  ).toContain("No certifican las lecturas ocultas");
});

test("query JSON mode sends electricity input and prints exactly one envelope", async () => {
  const directory = await mkdtemp(join(tmpdir(), "power-grid-json-"));
  let calls = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      calls += 1;
      expect(new URL(request.url).pathname).toBe(
        "/api/v1/challenges/power-grid/query",
      );
      expect(await request.json()).toEqual(powerGridExample);
      return Response.json({
        version: 1,
        ok: true,
        requestId: "power-query",
        data: {
          observation: {
            sequence: 1,
            input: powerGridExample,
            output: 420,
            createdAt: "2026-10-09T05:00:00Z",
          },
          queriesUsed: 1,
          queriesRemaining: 24,
          queriesLimit: 25,
        },
      });
    },
  });
  try {
    const inputPath = join(directory, "input.json");
    await writeFile(inputPath, JSON.stringify(powerGridExample));
    const entry = new URL("../src/index.ts", import.meta.url).pathname;
    const child = Bun.spawn(
      [
        process.execPath,
        entry,
        "--api-url",
        server.url.toString(),
        "--token",
        "test-token",
        "--output",
        "json",
        "challenge",
        "query",
        "--challenge",
        "power-grid",
        "--input",
        inputPath,
      ],
      { cwd: directory, stdout: "pipe", stderr: "pipe" },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
    expect(JSON.parse(stdout)).toMatchObject({
      version: 1,
      ok: true,
      data: {
        queriesRemaining: 24,
        observation: { input: powerGridExample, output: 420 },
      },
    });
    expect(stdout.trim().split("\n")).toHaveLength(1);
    expect(calls).toBe(1);
  } finally {
    server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});
