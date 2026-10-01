import { expect, test } from "bun:test";

import {
  type CandidateFilters,
  candidateFilterQuery,
  parseCandidateFilters,
} from "./candidate-filters";
import { candidateKeys } from "./candidate-queries";

test("restores all filters from a shared link and serializes them for API requests", () => {
  const filters = parseCandidateFilters(
    new URLSearchParams(
      "page=3&q=%20Ada%20&status=approved&country=PE&ranking=broken-agent&challenge=black-box",
    ),
  );
  expect(filters).toEqual({
    page: 3,
    query: "Ada",
    status: "approved",
    country: { kind: "country", code: "PE" },
    ranking: "broken-agent",
    challenge: "black-box",
  });
  expect(candidateFilterQuery(filters)).toBe(
    "page=3&q=Ada&status=approved&ranking=broken-agent&challenge=black-box&country=PE",
  );
});

test("normalizes repeated and invalid URL values identically for server and API", () => {
  const expected = {
    page: 1,
    query: "",
    status: undefined,
    ranking: undefined,
    challenge: undefined,
    country: { kind: "unknown" },
  } satisfies CandidateFilters;
  expect(
    parseCandidateFilters({
      page: "-2",
      country: ["unknown", "PE"],
      status: "bad",
      challenge: "bad",
    }),
  ).toEqual(expected);
  expect(
    parseCandidateFilters(
      new URLSearchParams(
        "page=-2&country=unknown&country=PE&status=bad&challenge=bad",
      ),
    ),
  ).toEqual(expected);
  expect(
    candidateFilterQuery(parseCandidateFilters({ country: "XX", page: "bad" })),
  ).toBe("");
});

test("keeps unknown, known and unrestricted country results in separate caches", () => {
  expect(
    [undefined, "unknown", "PE", "CO"].map((country) =>
      candidateKeys.list(parseCandidateFilters({ country })),
    ),
  ).toEqual([
    ["admin", "candidates", "list", ""],
    ["admin", "candidates", "list", "country=unknown"],
    ["admin", "candidates", "list", "country=PE"],
    ["admin", "candidates", "list", "country=CO"],
  ]);
});
