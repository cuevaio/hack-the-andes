import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { formatSoles, prizeAmountsPen } from "./content";
import { formatPrizeAmount, PrizeCounter } from "./prize-counter";

test("formats the accessible prize amount without counting up", () => {
  const numbered = formatPrizeAmount(6_700, "number");
  expect(numbered).toContain("6");
  expect(numbered).toContain("700");
  expect(formatPrizeAmount(1_675, "soles")).toBe(formatSoles(1_675));
});

test("formats first and second place as the final amounts, not zero", () => {
  expect(formatPrizeAmount(prizeAmountsPen.first, "number")).toBe(
    formatPrizeAmount(6_000, "number"),
  );
  expect(formatPrizeAmount(prizeAmountsPen.second, "soles")).toBe(
    formatSoles(2_000),
  );
  expect(formatPrizeAmount(prizeAmountsPen.first, "number")).not.toBe(
    formatPrizeAmount(0, "number"),
  );
  expect(formatPrizeAmount(prizeAmountsPen.second, "soles")).not.toBe(
    formatPrizeAmount(0, "soles"),
  );
});

test("server markup paints final prize amounts, not zero", () => {
  const first = renderToStaticMarkup(
    createElement(PrizeCounter, {
      amount: prizeAmountsPen.first,
      format: "number",
    }),
  );
  const second = renderToStaticMarkup(
    createElement(PrizeCounter, { amount: prizeAmountsPen.second }),
  );

  expect(first).toContain(formatPrizeAmount(6_000, "number"));
  expect(first).not.toBe(formatPrizeAmount(0, "number"));
  expect(first).not.toContain(`>${formatPrizeAmount(0, "number")}<`);
  expect(second).toContain(formatSoles(2_000));
  expect(second).not.toContain(formatSoles(0));
});
