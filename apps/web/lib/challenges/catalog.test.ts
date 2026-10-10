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

test("future dates and force-open cannot activate an unimplemented definition", () => {
  for (const slug of ["mountain-lodge"]) {
    const available = challengeBySlug(slug);
    const challenge = available && { ...available, playable: false };
    if (!challenge) throw new Error(`missing ${slug}`);
    for (const forceOpen of [false, true]) {
      const item = catalogItemFor(
        challenge,
        new Date("2026-11-01T00:00:00Z"),
        forceOpen,
      );
      expect(item.playable).toBe(false);
      expect(item.open).toBe(false);
    }
  }
});

test("advertises Power Grid v1 publicly at its launch time", () => {
  const challenge = challengeBySlug("power-grid");
  if (!challenge) throw new Error("missing power-grid");
  const item = catalogItemFor(
    challenge,
    new Date("2026-10-06T00:33:04Z"),
    false,
  );
  expect(item).toMatchObject({
    playable: true,
    open: true,
    challengeVersion: "power-grid-v1",
    queryLimit: 25,
    evaluationLimit: 3,
  });
});

test("admin early access opens only Power Grid in the personalized catalog", () => {
  const now = new Date("2026-10-05T17:00:00Z");
  for (const slug of ["power-grid", "black-box", "mountain-lodge"]) {
    const challenge = challengeBySlug(slug);
    if (!challenge) throw new Error(`missing ${slug}`);
    const item = catalogItemFor(challenge, now, false, true);
    expect(item.open).toBe(slug === "power-grid");
    if (slug === "power-grid") {
      expect(item.playable).toBe(true);
      expect(item.opensAt).toBe(challenge.opensAt);
      expect(item.closed).toBe(false);
    }
  }
});

test("Power Grid closes for participants and admins while preserving its version and ranking", () => {
  const challenge = challengeBySlug("power-grid");
  if (!challenge?.closesAt) throw new Error("missing closure");
  const now = new Date(challenge.closesAt);
  for (const admin of [false, true]) {
    expect(catalogItemFor(challenge, now, false, admin)).toMatchObject({
      open: false,
      closed: true,
      playable: true,
      challengeVersion: "power-grid-v1",
      rankingPath: "/challenges/power-grid",
    });
  }
});

test("Mountain Lodge publishes the fifth version and opens at the launch instant", () => {
  const challenge = challengeBySlug("mountain-lodge");
  if (!challenge) throw new Error("missing Mountain Lodge");
  expect(
    catalogItemFor(
      challenge,
      new Date(Date.parse(challenge.opensAt) - 1),
      false,
    ),
  ).toMatchObject({
    number: 5,
    playable: true,
    open: false,
    closed: false,
    challengeVersion: "mountain-lodge-v1",
    queryLimit: 25,
    evaluationLimit: 3,
  });
  expect(
    catalogItemFor(challenge, new Date(challenge.opensAt), false).open,
  ).toBe(true);
});
