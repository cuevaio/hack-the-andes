import { expect, test } from "bun:test";
import { Schema } from "effect";
import { challengeBySlug, isChallengeOpenAt } from "./index.js";
import { PowerReadingSchema, powerGridExample } from "./power-grid.js";

test("accepts zero and maximum readings and rejects malformed input", () => {
  const parse = Schema.decodeUnknownSync(PowerReadingSchema, {
    onExcessProperty: "error",
  });
  expect(
    parse({ ...powerGridExample, consumptionKwh: 0, demandKw: 0 }),
  ).toMatchObject({ consumptionKwh: 0 });
  expect(
    parse({
      ...powerGridExample,
      consumptionKwh: 2000,
      demandKw: 100,
      hour: 23,
    }),
  ).toMatchObject({ hour: 23 });
  for (const patch of [
    { consumptionKwh: -1 },
    { consumptionKwh: 2001 },
    { demandKw: 101 },
    { demandKw: 1.5 },
    { hour: 24 },
    { solar: "false" },
    { business: undefined },
    { extra: 1 },
  ]) {
    expect(() => parse({ ...powerGridExample, ...patch })).toThrow();
  }
});

test("challenge four preserves the black-box budgets and scheduled opening", () => {
  const challenge = challengeBySlug("power-grid");
  if (!challenge) throw new Error("Missing power-grid");
  expect(challenge).toMatchObject({
    number: 4,
    playable: true,
    format: "accuracy",
    queryLimit: 25,
    evaluationLimit: 3,
    hiddenSampleSize: 1000,
  });
  expect(isChallengeOpenAt(challenge, new Date("2026-10-09T04:59:59Z"))).toBe(
    false,
  );
  expect(isChallengeOpenAt(challenge, new Date("2026-10-09T05:00:00Z"))).toBe(
    true,
  );
});
