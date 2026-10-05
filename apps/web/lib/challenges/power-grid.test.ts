import { expect, test } from "bun:test";
import { powerGridExample } from "@chofex/challenges-contract/power-grid";
import { createChallengeEngine } from "./engine";
import { runPowerGridSolution, runShippingSolution } from "./sandbox";

test("queries the electricity version with the electricity input", async () => {
  const engine = createChallengeEngine({
    baseUrl: "https://engine.example",
    apiSecret: "secret",
    fetch: async (_url, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        version: 1,
        challengeVersion: "power-grid-v1",
        participantKey: "participant_1",
        input: powerGridExample,
      });
      return Response.json({ version: 1, output: 420 });
    },
  });
  expect(await engine.queryPowerGrid("participant_1", powerGridExample)).toBe(
    420,
  );
});

test("executes each supported electricity entry point and preserves shipping", async () => {
  for (const source of [
    "function calculateBill(input) { return input.consumptionKwh + input.demandKw; }",
    "module.exports.calculateBill = input => input.consumptionKwh + input.demandKw;",
    "module.exports = input => input.consumptionKwh + input.demandKw;",
  ]) {
    expect(await runPowerGridSolution(source, [powerGridExample])).toEqual([
      105,
    ]);
  }
  expect(
    await runShippingSolution(
      "function calculateShipping(input) { return input.distanceKm; }",
      [
        {
          distanceKm: 10,
          weightKg: 3,
          hour: 12,
          express: false,
          fragile: false,
        },
      ],
    ),
  ).toEqual([10]);
  await expect(
    runPowerGridSolution("function calculateBill() { return process.env; }", [
      powerGridExample,
    ]),
  ).rejects.toThrow();
  await expect(
    runPowerGridSolution("function calculateBill() { return NaN; }", [
      powerGridExample,
    ]),
  ).rejects.toThrow();
});
