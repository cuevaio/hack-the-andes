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
    view: undefined,
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
    view: undefined,
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
    [undefined, "unknown", "PE", "CO", "outside_peru"].map((country) =>
      candidateKeys.list(parseCandidateFilters({ country })),
    ),
  ).toEqual([
    ["admin", "candidates", "list", ""],
    ["admin", "candidates", "list", "country=unknown"],
    ["admin", "candidates", "list", "country=PE"],
    ["admin", "candidates", "list", "country=CO"],
    ["admin", "candidates", "list", "country=outside_peru"],
  ]);
});

test("preserves outside-Peru scope through API and history serialization", () => {
  const filters = parseCandidateFilters({
    country: "outside_peru",
    page: "2",
    q: "Ana",
  });
  expect(filters.country).toEqual({ kind: "outside_peru" });
  expect(candidateFilterQuery(filters)).toBe(
    "page=2&q=Ana&country=outside_peru",
  );
});

test("restores a ranking view with a valid default challenge", () => {
  const filters = parseCandidateFilters({
    view: "ranking",
    ranking: "invalid",
  });
  expect(filters.view).toBe("ranking");
  expect(filters.ranking).toBe("black-box");
  expect(candidateFilterQuery(filters)).toBe("view=ranking&ranking=black-box");
  expect(candidateKeys.list(filters)).not.toEqual(
    candidateKeys.list(parseCandidateFilters({ ranking: "black-box" })),
  );
});

test("keeps ranking scope and selection filters in shared links", () => {
  const filters = parseCandidateFilters({
    view: "ranking",
    ranking: "broken-agent",
    country: "PE",
    status: "approved",
    q: "Ana",
    page: "2",
  });
  expect(candidateFilterQuery(filters)).toBe(
    "page=2&q=Ana&status=approved&view=ranking&ranking=broken-agent&country=PE",
  );
  expect(
    parseCandidateFilters(new URLSearchParams(candidateFilterQuery(filters))),
  ).toEqual(filters);
  expect(parseCandidateFilters({ view: "invalid" }).view).toBeUndefined();
});
