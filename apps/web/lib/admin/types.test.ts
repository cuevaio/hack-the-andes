import { expect, test } from "bun:test";

import { candidateFunnelStatusFor } from "./funnel-status";
import {
  candidateFunnelStatuses,
  parseCandidateFilter,
  parseCandidateRankingSort,
} from "./types";

test("publishes the candidate funnel in operating order", () => {
  expect(candidateFunnelStatuses).toEqual([
    "registration_started",
    "registration_completed",
    "challenge_started",
    "challenge_completed",
    "approved",
    "declined",
  ]);
  for (const status of candidateFunnelStatuses) {
    expect(parseCandidateFilter(status)).toBe(status);
  }
});

test("rejects an unknown participant filter", () => {
  expect(parseCandidateFilter("completed")).toBeUndefined();
  expect(parseCandidateFilter("submitted")).toBeUndefined();
});

test("accepts only playable challenges as ranking sorts", () => {
  expect(parseCandidateRankingSort("black-box")).toBe("black-box");
  expect(parseCandidateRankingSort("broken-agent")).toBe("broken-agent");
  expect(parseCandidateRankingSort("make-it-fast")).toBe("make-it-fast");
  expect(parseCandidateRankingSort("unknown")).toBeUndefined();
  expect(parseCandidateRankingSort(undefined)).toBeUndefined();
});

const challenge = (
  status: "not_started" | "in_progress" | "evaluated",
  playable = true,
) => ({
  slug: "black-box" as const,
  title: "The Shipping Machine",
  theme: "Black Box",
  status,
  open: true,
  playable,
  queriesUsed: status === "not_started" ? 0 : 1,
  queriesLimit: 25,
  evaluationsUsed: status === "evaluated" ? 1 : 0,
  evaluationsLimit: 3,
});

test("derives one candidate funnel status with decisions taking precedence", () => {
  expect(candidateFunnelStatusFor("draft", undefined, [])).toBe(
    "registration_started",
  );
  expect(
    candidateFunnelStatusFor("draft", undefined, [challenge("evaluated")]),
  ).toBe("registration_started");
  expect(
    candidateFunnelStatusFor("submitted", "2026-09-18T12:00:00Z", []),
  ).toBe("registration_completed");
  expect(
    candidateFunnelStatusFor("submitted", "2026-09-18T12:00:00Z", [
      challenge("evaluated", false),
    ]),
  ).toBe("registration_completed");
  expect(
    candidateFunnelStatusFor("submitted", "2026-09-18T12:00:00Z", [
      challenge("in_progress"),
    ]),
  ).toBe("challenge_started");
  expect(
    candidateFunnelStatusFor("submitted", "2026-09-18T12:00:00Z", [
      challenge("in_progress"),
      challenge("evaluated"),
    ]),
  ).toBe("challenge_completed");
  expect(
    candidateFunnelStatusFor("accepted", "2026-09-18T12:00:00Z", [
      challenge("evaluated"),
    ]),
  ).toBe("approved");
  expect(
    candidateFunnelStatusFor("rejected", "2026-09-18T12:00:00Z", [
      challenge("evaluated"),
    ]),
  ).toBe("declined");
});
