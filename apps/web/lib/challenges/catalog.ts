import {
  type ChallengeCatalogItem,
  type ChallengeDefinition,
  challengeAdmissionNotice,
  challengeCatalog,
  isChallengeClosedAt,
  isChallengeOpenAt,
} from "@chofex/challenges-contract";

import { powerGridChallengeSlug } from "@chofex/challenges-contract/power-grid";
import { challengesForceOpen, currentChallengeTime } from "./clock";
import { hasChallengeEarlyAccess } from "./early-access";
import { currentChallengeVersionFor } from "./engine";

export const rankingPathFor = (slug: string): string => `/challenges/${slug}`;

export const catalogItemFor = (
  challenge: ChallengeDefinition,
  now: Date = currentChallengeTime(),
  forceOpen = challengesForceOpen(),
  adminEarlyAccess = false,
): ChallengeCatalogItem => {
  const earlyAccess =
    adminEarlyAccess &&
    challenge.slug === powerGridChallengeSlug &&
    !isChallengeClosedAt(challenge, now);
  const closed =
    !earlyAccess && !forceOpen && isChallengeClosedAt(challenge, now);
  const open =
    earlyAccess ||
    (challenge.playable && isChallengeOpenAt(challenge, now, forceOpen));
  const item: ChallengeCatalogItem = {
    slug: challenge.slug,
    number: challenge.number,
    code: challenge.code,
    theme: challenge.theme,
    title: challenge.title,
    summary: challenge.summary,
    coreSkill: challenge.coreSkill,
    format: challenge.format,
    formatLabel: challenge.formatLabel,
    opensAt: challenge.opensAt,
    queryLimit: challenge.queryLimit,
    evaluationLimit: challenge.evaluationLimit,
    playable: earlyAccess || challenge.playable,
    open,
    closed,
    rankingPath: rankingPathFor(challenge.slug),
  };
  let publicItem = item;
  const challengeVersion = currentChallengeVersionFor(challenge.slug);
  if (challengeVersion) {
    publicItem = { ...publicItem, challengeVersion };
  }
  if (challenge.closesAt) {
    publicItem = { ...publicItem, closesAt: challenge.closesAt };
  }
  if (challenge.rankingVisibleAt) {
    publicItem = {
      ...publicItem,
      rankingVisibleAt: challenge.rankingVisibleAt,
    };
  }
  return publicItem;
};

export const publicChallengeCatalog = (
  now: Date = currentChallengeTime(),
): ReadonlyArray<ChallengeCatalogItem> =>
  challengeCatalog.map((challenge) => catalogItemFor(challenge, now));

export const listPublicChallenges = (
  now: Date = currentChallengeTime(),
): {
  admission: {
    challengesMandatory: true;
    selectionBasis: "challenge_rankings";
    notice: string;
  };
  challenges: ReadonlyArray<ChallengeCatalogItem>;
} => ({
  admission: {
    challengesMandatory: true,
    selectionBasis: "challenge_rankings",
    notice: challengeAdmissionNotice,
  },
  challenges: publicChallengeCatalog(now),
});

export const listParticipantChallenges = async (
  clerkUserId: string,
  now: Date = currentChallengeTime(),
) => {
  const earlyAccess = await hasChallengeEarlyAccess(
    clerkUserId,
    powerGridChallengeSlug,
  );
  return {
    ...listPublicChallenges(now),
    challenges: challengeCatalog.map((challenge) =>
      catalogItemFor(challenge, now, challengesForceOpen(), earlyAccess),
    ),
  };
};
