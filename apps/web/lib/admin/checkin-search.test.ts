import { expect, test } from "bun:test";
import type { CheckinParticipant } from "./checkin-contract";
import {
  matchesCheckinSearch,
  visibleCheckinParticipants,
} from "./checkin-search";

const participant: CheckinParticipant = {
  participantId: "00000000-0000-4000-8000-000000000001",
  applicationId: "00000000-0000-4000-8000-000000000002",
  name: "Pepe",
  legalName: "José García",
  email: "jose@example.com",
  pictureUrl: null,
  document: { status: "available", lastFour: "5678" },
  eligibility: "ready",
  checkedInAt: null,
};
test("search matches public and legal names, email case, and documents with punctuation", () => {
  expect(matchesCheckinSearch(participant, "12345678", "pepe")).toBe(true);
  expect(matchesCheckinSearch(participant, "12345678", "jose garcia")).toBe(
    true,
  );
  expect(
    matchesCheckinSearch(participant, "12345678", "JOSE@EXAMPLE.COM"),
  ).toBe(true);
  expect(matchesCheckinSearch(participant, "12345678", "12-345 678")).toBe(
    true,
  );
  expect(matchesCheckinSearch(participant, "12345678", "87654321")).toBe(false);
});
test("status filters and all sort options preserve input and put missing arrival times last", () => {
  const people: CheckinParticipant[] = [
    {
      ...participant,
      applicationId: "00000000-0000-4000-8000-000000000003",
      name: "Zoé",
      checkedInAt: "2026-10-17T14:00:00Z",
    },
    { ...participant, name: "Ángela", checkedInAt: null },
    {
      ...participant,
      applicationId: "00000000-0000-4000-8000-000000000004",
      name: "Luis",
      checkedInAt: "2026-10-17T13:00:00Z",
    },
  ];
  const names = (result: readonly CheckinParticipant[]) =>
    result.map((person) => person.name);
  expect(names(visibleCheckinParticipants(people, "all", "name-asc"))).toEqual([
    "Ángela",
    "Luis",
    "Zoé",
  ]);
  expect(names(visibleCheckinParticipants(people, "all", "name-desc"))).toEqual(
    ["Zoé", "Luis", "Ángela"],
  );
  expect(
    names(visibleCheckinParticipants(people, "checked-in", "arrival-asc")),
  ).toEqual(["Luis", "Zoé"]);
  expect(
    names(visibleCheckinParticipants(people, "all", "arrival-desc")),
  ).toEqual(["Zoé", "Luis", "Ángela"]);
  expect(
    names(visibleCheckinParticipants(people, "not-checked-in", "name-asc")),
  ).toEqual(["Ángela"]);
  expect(names(people)).toEqual(["Zoé", "Ángela", "Luis"]);
});
