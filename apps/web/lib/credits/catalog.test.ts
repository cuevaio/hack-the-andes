import { expect, test } from "bun:test";
import { CreditsSchema } from "@chofex/registration-contract";
import { Schema } from "effect";
import { creditsForCheckin } from "./catalog";

test("credits require confirmed check-in", () => {
  expect(() => creditsForCheckin(false)).toThrow(
    "Los créditos se habilitan después del check-in",
  );
  try {
    creditsForCheckin(false);
  } catch (error) {
    expect(error).toMatchObject({ status: 403, code: "CHECKIN_REQUIRED" });
  }
});
test("checked-in participants receive all sponsor redemption details", () => {
  const result = Schema.decodeUnknownSync(CreditsSchema)(
    creditsForCheckin(true),
  );
  expect(result.credits).toHaveLength(10);
  expect(
    result.credits.find((item) => item.sponsor === "Tavily"),
  ).toMatchObject({
    code: "ANDESHACK",
    url: "https://app.tavily.com/redeem/ANDESHACK",
  });
  expect(result.credits.find((item) => item.sponsor === "Lovable")?.code).toBe(
    "COMM-ANDES-K7QZ",
  );
});
