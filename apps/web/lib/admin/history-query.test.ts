import { expect, test } from "bun:test";
import { parseHistoryQuery } from "./history-query";

test("uses the Lima day rather than the UTC day for the default cutoff", () => {
  expect(parseHistoryQuery({}, new Date("2026-10-02T03:00:00Z"))).toEqual({
    end: "2026-10-01",
    days: 30,
    now: "2026-10-02T03:00:00.000Z",
    country: undefined,
    challenge: undefined,
    showUpPercent: 100,
    costPerConfirmation: undefined,
  });
});

test("rejects impossible and future dates and unsafe planning assumptions", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  for (const end of ["2026-02-30", "2026-12-01", "nonsense", "0000-01-01"]) {
    const query = parseHistoryQuery(
      { end, showUp: "0", cost: "Infinity", days: "900" },
      now,
    );
    expect([
      query.end,
      query.days,
      query.showUpPercent,
      query.costPerConfirmation,
    ]).toEqual(["2026-10-02", 30, 100, undefined]);
  }
  const query = parseHistoryQuery(
    {
      end: "2026-09-24",
      days: "14",
      showUp: "80",
      cost: "25.50",
      country: "PE",
      challenge: "broken-agent",
    },
    now,
  );
  expect(query).toEqual({
    end: "2026-09-24",
    days: 14,
    now: "2026-10-02T12:00:00.000Z",
    country: { kind: "country", code: "PE" },
    challenge: "broken-agent",
    showUpPercent: 80,
    costPerConfirmation: 25.5,
  });
});
