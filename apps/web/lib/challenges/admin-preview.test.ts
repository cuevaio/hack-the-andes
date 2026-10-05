import { expect, mock, test } from "bun:test";
import { powerGridExample } from "@chofex/challenges-contract/power-grid";
import type { createChallengeEngine } from "./engine";

mock.module("server-only", () => ({}));
const {
  createAdminPreview,
  parseAdminPreviewRequest,
  requireAdminPreviewSecret,
} = await import("./admin-preview");

const score = {
  accuracy: 0.5,
  exactCount: 500,
  sampleSize: 1000,
  meanError: 3,
  queriesUsed: 0,
  runtimeMs: 10,
};

test("preview is disabled without a configured strong key and rejects missing or wrong keys", () => {
  const key = "valid-preview-key-with-at-least-32-characters";
  expect(() => requireAdminPreviewSecret(null, key)).toThrow("clave");
  expect(() => requireAdminPreviewSecret("wrong", key)).toThrow("clave");
  expect(() => requireAdminPreviewSecret(key, "short")).toThrow("configurada");
  expect(() => requireAdminPreviewSecret(key, "")).toThrow("configurada");
  expect(() => requireAdminPreviewSecret(key, key)).not.toThrow();
});

test("preview validates readings, finite observations, code and batch bounds", () => {
  expect(
    parseAdminPreviewRequest({ action: "query", input: powerGridExample }),
  ).toMatchObject({ action: "query" });
  for (const input of [
    { action: "anything" },
    { action: "query", input: { ...powerGridExample, demandKw: -1 } },
    {
      action: "test",
      source: "x",
      observations: [{ input: powerGridExample, output: Infinity }],
    },
    { action: "evaluate", source: "x".repeat(32769) },
    { action: "query", input: powerGridExample, bypass: true },
  ])
    expect(() => parseAdminPreviewRequest(input)).toThrow();
});

test("admin preview uses an isolated deterministic seed, checks the notebook and returns hidden scores", async () => {
  const keys: string[] = [];
  const engine = {
    query: async () => 0,
    queryPowerGrid: async (key) => {
      keys.push(key);
      return 105;
    },
    evaluate: async (version, key, _source, queriesUsed) => {
      expect(version).toBe("power-grid-v1");
      expect(queriesUsed).toBe(0);
      keys.push(key);
      return score;
    },
  } satisfies ReturnType<typeof createChallengeEngine>;
  const preview = createAdminPreview(engine);
  expect(await preview("admin-a", { action: "unlock" })).toEqual({
    action: "unlock",
    version: "power-grid-v1",
  });
  expect(keys).toHaveLength(0);
  expect(
    await preview("admin-a", { action: "query", input: powerGridExample }),
  ).toEqual({
    action: "query",
    observation: { input: powerGridExample, output: 105 },
  });
  expect(
    await preview("admin-a", {
      action: "evaluate",
      source: "function calculateBill() { return 0; }",
    }),
  ).toEqual({ action: "evaluate", score });
  await preview("admin-b", { action: "query", input: powerGridExample });
  expect(keys[0]).toBe(keys[1]);
  expect(keys[0]).not.toBe(keys[2]);
  expect(keys[0]).not.toBe("admin-a");
  const result = await preview("admin-a", {
    action: "test",
    source:
      "function calculateBill(input) { return input.consumptionKwh + input.demandKw; }",
    observations: [
      { input: powerGridExample, output: 105 },
      { input: { ...powerGridExample, consumptionKwh: 200 }, output: 999 },
    ],
  });
  expect(result).toMatchObject({
    action: "test",
    result: {
      accuracy: 0.5,
      meanError: 397,
      matchedObservations: 1,
      observationCount: 2,
      mismatches: [{ sequence: 2, expected: 999, actual: 205 }],
    },
  });
  await expect(
    preview("admin-a", {
      action: "test",
      source: "function calculateBill(){return 0;}",
      observations: [],
    }),
  ).rejects.toThrow("cuaderno");
});
