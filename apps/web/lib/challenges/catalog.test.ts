import { expect, test } from "bun:test";
import { challengeBySlug } from "@chofex/challenges-contract";

import { catalogItemFor, listPublicChallenges } from "./catalog";
import { currentChallengeVersionFor } from "./engine";

test("publishes the mandatory ranked admission policy to CLI clients", () => {
  expect(listPublicChallenges().admission).toMatchObject({
    challengesMandatory: true,
    selectionBasis: "challenge_rankings",
  });
  expect(listPublicChallenges().admission.notice).toContain(
    "no reserva una plaza",
  );
});

test("the implemented third challenge is playable but not open before its launch", () => {
  const challenge = challengeBySlug("make-it-fast");
  if (!challenge) throw new Error("missing make-it-fast");

  const item = catalogItemFor(
    challenge,
    new Date("2026-09-25T05:00:00.000Z"),
    false,
  );

  expect(item.playable).toBe(true);
  expect(item.open).toBe(false);
  expect(item.challengeVersion).toBe("slow-service-v3");
});

test("advertises only the current playable challenge version", () => {
  const challenge = challengeBySlug("broken-agent");
  if (!challenge) throw new Error("missing broken-agent");

  const item = catalogItemFor(challenge);

  expect(item.challengeVersion).toBe(
    currentChallengeVersionFor("broken-agent"),
  );
  expect(item.challengeVersion).not.toBe("broken-agent-v1");
});
