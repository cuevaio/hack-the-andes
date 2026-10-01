import { describe, expect, test } from "bun:test";

import { needsFunnelReminder } from "./eligibility";

const progress = {
  applicationStatus: undefined,
  applicationSubmitted: false,
  challengeStarted: false,
  challengeCompleted: false,
  challengeFinishAvailable: true,
};

describe("funnel reminder eligibility", () => {
  test("nudges an authenticated user who has not submitted an application", () => {
    expect(needsFunnelReminder("registration", progress)).toBe(true);
    expect(
      needsFunnelReminder("registration", {
        ...progress,
        applicationStatus: "submitted",
        applicationSubmitted: true,
      }),
    ).toBe(false);
  });

  test("nudges an active applicant who has not started the challenge", () => {
    expect(
      needsFunnelReminder("challenge_start", {
        ...progress,
        applicationStatus: "submitted",
        applicationSubmitted: true,
      }),
    ).toBe(true);
    expect(
      needsFunnelReminder("challenge_start", {
        ...progress,
        applicationStatus: "submitted",
        applicationSubmitted: true,
        challengeStarted: true,
      }),
    ).toBe(false);
  });

  test("nudges an active applicant who started but has not finished", () => {
    expect(
      needsFunnelReminder("challenge_finish", {
        ...progress,
        applicationStatus: "under_review",
        applicationSubmitted: true,
        challengeStarted: true,
      }),
    ).toBe(true);
    expect(
      needsFunnelReminder("challenge_finish", {
        applicationStatus: "under_review",
        applicationSubmitted: true,
        challengeStarted: true,
        challengeCompleted: true,
        challengeFinishAvailable: false,
      }),
    ).toBe(false);
  });

  test("does not send challenge nudges after a decision", () => {
    for (const applicationStatus of ["accepted", "rejected", "withdrawn"]) {
      expect(
        needsFunnelReminder("challenge_start", {
          ...progress,
          applicationStatus,
          applicationSubmitted: true,
        }),
      ).toBe(false);
    }
  });

  test("does not ask an evaluated participant to start another challenge", () => {
    expect(
      needsFunnelReminder("challenge_start", {
        ...progress,
        applicationStatus: "submitted",
        applicationSubmitted: true,
        challengeCompleted: true,
      }),
    ).toBe(false);
  });

  test("does not promise another evaluation after the budget is exhausted", () => {
    expect(
      needsFunnelReminder("challenge_finish", {
        applicationStatus: "submitted",
        applicationSubmitted: true,
        challengeStarted: true,
        challengeCompleted: false,
        challengeFinishAvailable: false,
      }),
    ).toBe(false);
  });

  test("does not send participation nudges after the challenge closes", () => {
    const activeCandidate = {
      ...progress,
      applicationStatus: "submitted",
      applicationSubmitted: true,
    };

    expect(needsFunnelReminder("challenge_start", activeCandidate, false)).toBe(
      false,
    );
    expect(
      needsFunnelReminder(
        "challenge_finish",
        { ...activeCandidate, challengeStarted: true },
        false,
      ),
    ).toBe(false);
  });
});
