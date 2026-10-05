import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("creates the Power Grid starter without overwriting an existing directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "power-grid-scaffold-"));
  const previousDirectory = process.cwd();
  process.chdir(directory);
  try {
    expect(
      await Effect.runPromise(createChallengeScaffold("power-grid")),
    ).toEqual({
      challenge: "power-grid",
      path: "power-grid",
      status: "created",
    });
    const file = join(directory, "power-grid/bill.js");
    expect(await Bun.file(file).text()).toContain(
      "function calculateBill(input)",
    );
    expect(
      await Bun.file(join(directory, "power-grid/input.json")).json(),
    ).toEqual(powerGridExample);
    await writeFile(file, "my solution");
    expect(
      (await Effect.runPromise(createChallengeScaffold("power-grid"))).status,
    ).toBe("exists");
    expect(await Bun.file(file).text()).toBe("my solution");
  } finally {
    process.chdir(previousDirectory);
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
