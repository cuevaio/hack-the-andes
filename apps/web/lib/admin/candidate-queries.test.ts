import { expect, test } from "bun:test";

import { candidateListOptions } from "./candidate-queries";

test("keeps an open candidate dashboard synchronized", () => {
  const options = candidateListOptions({
    page: 1,
    query: "",
    ranking: "broken-agent",
  });

  expect(options.refetchInterval).toBe(60_000);
  expect(options.refetchOnWindowFocus).toBe("always");
  expect([...options.queryKey]).toEqual([
    "admin",
    "candidates",
    "list",
    "ranking=broken-agent",
  ]);
});
