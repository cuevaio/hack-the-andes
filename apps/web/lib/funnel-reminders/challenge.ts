import {
  type ChallengeDefinition,
  isChallengeOpenAt,
  playableChallenges,
} from "@chofex/challenges-contract";

import { challengesForceOpen, currentChallengeTime } from "../challenges/clock";
import { currentChallengeVersionFor } from "../challenges/engine";

export const reminderChallenge = (
  now: Date = currentChallengeTime(),
  forceOpen = challengesForceOpen(),
): ChallengeDefinition | undefined =>
  playableChallenges.find((challenge) =>
    isChallengeOpenAt(challenge, now, forceOpen),
  );

export const isCurrentReminderAttempt = (attempt: {
  readonly challengeSlug: string;
  readonly challengeVersion: string;
}): boolean => {
  const version = currentChallengeVersionFor(attempt.challengeSlug);
  return version !== undefined && attempt.challengeVersion === version;
};
