import {
  type ChallengeDefinition,
  challengeClosingNotice,
  challengeOpeningNotice,
  isChallengeClosedAt,
  isChallengeOpenAt,
} from "@chofex/challenges-contract";

import { powerGridChallengeSlug } from "@chofex/challenges-contract/power-grid";

import { HttpError } from "../registration/http";

export const requireChallengeParticipationOpen = (
  challenge: ChallengeDefinition,
  now: Date,
  forceOpen: boolean,
  adminEarlyAccess = false,
): ChallengeDefinition => {
  if (
    adminEarlyAccess &&
    challenge.slug === powerGridChallengeSlug &&
    !isChallengeClosedAt(challenge, now)
  )
    return challenge;
  if (!challenge.playable) {
    throw new HttpError(
      404,
      "CHALLENGE_NOT_AVAILABLE",
      `${challenge.title} todavía no está disponible`,
    );
  }
  if (!forceOpen && isChallengeClosedAt(challenge, now)) {
    throw new HttpError(
      403,
      "CHALLENGE_CLOSED",
      challengeClosingNotice(challenge.title),
      false,
      { closesAt: challenge.closesAt },
    );
  }
  if (!isChallengeOpenAt(challenge, now, forceOpen)) {
    throw new HttpError(
      403,
      "CHALLENGE_NOT_OPEN",
      challengeOpeningNotice(challenge.title, challenge.opensAt),
      false,
      { opensAt: challenge.opensAt },
    );
  }
  return challenge;
};
