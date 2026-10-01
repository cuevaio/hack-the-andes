import {
  type ChallengeDefinition,
  isChallengeOpenAt,
  playableChallenges,
} from "@chofex/challenges-contract";

import { challengesForceOpen, currentChallengeTime } from "../challenges/clock";
import { currentChallengeVersionFor } from "../challenges/engine";

export const reminderChallenge = ({
  slug,
  now = currentChallengeTime(),
  forceOpen = challengesForceOpen(),
}: {
  readonly slug?: string;
  readonly now?: Date;
  readonly forceOpen?: boolean;
} = {}): ChallengeDefinition | undefined =>
  playableChallenges.find(
    (challenge) =>
      (slug === undefined || challenge.slug === slug) &&
      isChallengeOpenAt(challenge, now, forceOpen),
  );

export const isCurrentReminderAttempt = (attempt: {
  readonly challengeSlug: string;
  readonly challengeVersion: string;
}): boolean => {
  const version = currentChallengeVersionFor(attempt.challengeSlug);
  return version !== undefined && attempt.challengeVersion === version;
};
