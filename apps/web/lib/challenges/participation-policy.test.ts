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

test("admin early access precedes launch and ordinary participants can enter after launch", () => {
  const challenge = challengeBySlug("power-grid");
  if (!challenge) throw new Error("missing power-grid");
  for (const now of [
    new Date("2026-10-05T17:00:00Z"),
    new Date("2026-10-06T00:33:03Z"),
  ]) {
    expect(requireChallengeParticipationOpen(challenge, now, false, true)).toBe(
      challenge,
    );
    expect(() =>
      requireChallengeParticipationOpen(challenge, now, false),
    ).toThrow("abre");
  }
  expect(
    requireChallengeParticipationOpen(
      challenge,
      new Date("2026-10-06T00:33:04Z"),
      false,
    ),
  ).toBe(challenge);
  const closed = challengeBySlug("black-box");
  if (!closed) throw new Error("missing black-box");
  expect(() =>
    requireChallengeParticipationOpen(
      closed,
      new Date("2026-10-05T17:00:00Z"),
      false,
      true,
    ),
  ).toThrow("cerrado");
});

test("Power Grid rejects new work at closure even with admin early access", () => {
  const challenge = challengeBySlug("power-grid");
  if (!challenge?.closesAt) throw new Error("missing Power Grid closure");
  const closedAt = new Date(challenge.closesAt);
  for (const admin of [false, true])
    expect(() =>
      requireChallengeParticipationOpen(challenge, closedAt, false, admin),
    ).toThrow("cerrado");
});
