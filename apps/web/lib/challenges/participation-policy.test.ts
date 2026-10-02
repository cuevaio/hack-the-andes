import { expect, test } from "bun:test";
import { challengeBySlug } from "@chofex/challenges-contract";

import { HttpError } from "../registration/http";
import { requireChallengeParticipationOpen } from "./participation-policy";

test("rejects every participation operation after the challenge closes", () => {
  const challenge = challengeBySlug("black-box");
  if (!challenge) throw new Error("missing black-box");

  try {
    requireChallengeParticipationOpen(
      challenge,
      new Date("2026-09-24T17:20:00.000Z"),
      false,
    );
    throw new Error("expected the closed challenge to be rejected");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    if (!(error instanceof HttpError)) throw error;
    expect(error.status).toBe(403);
    expect(error.code).toBe("CHALLENGE_CLOSED");
    expect(error.message).toMatch(/cerrado/i);
  }
});

test("keeps the explicit development override", () => {
  const challenge = challengeBySlug("black-box");
  if (!challenge) throw new Error("missing black-box");

  expect(
    requireChallengeParticipationOpen(
      challenge,
      new Date("2026-09-24T17:20:00.000Z"),
      true,
    ),
  ).toBe(challenge);
});

test("Scheduler rejects new work at its deadline and tells participants to wait", () => {
  const challenge = challengeBySlug("broken-agent");
  if (!challenge) throw new Error("missing broken-agent");
  try {
    requireChallengeParticipationOpen(
      challenge,
      new Date("2026-10-02T05:00:00.000Z"),
      false,
    );
    throw new Error("expected Scheduler to be closed");
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    expect(error.status).toBe(403);
    expect(error.code).toBe("CHALLENGE_CLOSED");
    expect(error.message).toContain("Espera el próximo challenge");
    expect(error.message).toContain(
      "Tu historial y el ranking siguen disponibles",
    );
  }
});
