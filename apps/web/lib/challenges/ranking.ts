import {
  type ChallengeRanking,
  type ChallengeRankingEntry,
  type ChallengeScore,
  challengeBySlug,
  isChallengeRankingVisibleAt,
} from "@chofex/challenges-contract";
import { db } from "@chofex/db";
import { and, desc, eq, inArray } from "@chofex/db/orm";
import {
  applications,
  challengeAttempts,
  challengeEvaluations,
  participants,
} from "@chofex/db/schema";
import { HttpError } from "../registration/http";
import { catalogItemFor } from "./catalog";
import { challengesForceOpen, currentChallengeTime } from "./clock";
import { currentChallengeVersionFor } from "./engine";
import {
  publicProfileIdentitiesFor,
  publicProfileLinksFor,
  rankingDisplayName,
} from "./names";
import {
  compareRankedChallengeEvaluations,
  competitionRanksForEvaluations,
  publicRankingEntries,
} from "./ranking-policy";
import { scoreFromStored } from "./score";

export interface RankedEvaluation {
  readonly attemptId: string;
  readonly participantId: string;
  readonly shareCode: string;
  readonly score: ChallengeScore;
  readonly evaluatedAt: Date;
}

export type RankingDatabase = Pick<typeof db, "select" | "selectDistinctOn">;

export const rankedEvaluationsFor = async (
  slug: string,
  database: RankingDatabase = db,
): Promise<Array<RankedEvaluation>> => {
  const challengeVersion = currentChallengeVersionFor(slug);
  if (!challengeVersion) return [];
  const applicationRows = await database
    .select({
      participantId: applications.participantId,
      status: applications.status,
      githubUrl: applications.githubUrl,
      linkedInUrl: applications.linkedInUrl,
      participantCreatedAt: participants.createdAt,
    })
    .from(applications)
    .innerJoin(participants, eq(participants.id, applications.participantId))
    .orderBy(desc(applications.createdAt), desc(applications.id));

  const applicationsByParticipant = new Map<
    string,
    Array<(typeof applicationRows)[number]>
  >();
  for (const application of applicationRows) {
    const participantApplications =
      applicationsByParticipant.get(application.participantId) ?? [];
    participantApplications.push(application);
    applicationsByParticipant.set(
      application.participantId,
      participantApplications,
    );
  }

  const eligibleApplications: Array<(typeof applicationRows)[number]> = [];
  for (const participantApplications of applicationsByParticipant.values()) {
    if (participantApplications[0]?.status === "withdrawn") continue;
    const eligibleApplication = participantApplications.find(
      (application) => application.status !== "draft",
    );
    if (eligibleApplication && eligibleApplication.status !== "withdrawn") {
      eligibleApplications.push(eligibleApplication);
    }
  }
  eligibleApplications.sort((left, right) => {
    const createdAtDifference =
      left.participantCreatedAt.getTime() -
      right.participantCreatedAt.getTime();
    if (createdAtDifference !== 0) return createdAtDifference;
    return left.participantId.localeCompare(right.participantId);
  });

  const claimedProfileIdentities = new Set<string>();
  const eligibleParticipantIds: Array<string> = [];
  for (const application of eligibleApplications) {
    const identities = publicProfileIdentitiesFor(application);
    const profileIdentities = [
      identities.github ? `github:${identities.github}` : undefined,
      identities.linkedIn ? `linkedin:${identities.linkedIn}` : undefined,
    ].filter((identity): identity is string => Boolean(identity));
    const duplicate = profileIdentities.some((identity) =>
      claimedProfileIdentities.has(identity),
    );
    for (const identity of profileIdentities) {
      claimedProfileIdentities.add(identity);
    }
    if (duplicate) continue;
    eligibleParticipantIds.push(application.participantId);
  }
  if (eligibleParticipantIds.length === 0) return [];

  const rows = await database
    .select({
      attemptId: challengeAttempts.id,
      participantId: challengeAttempts.participantId,
      shareCode: challengeAttempts.shareCode,
      evaluationsUsed: challengeAttempts.evaluationsUsed,
      evaluation: challengeEvaluations,
    })
    .from(challengeAttempts)
    .innerJoin(
      challengeEvaluations,
      eq(challengeEvaluations.id, challengeAttempts.bestEvaluationId),
    )
    .where(
      and(
        eq(challengeAttempts.challengeSlug, slug),
        eq(challengeAttempts.challengeVersion, challengeVersion),
        inArray(challengeAttempts.participantId, eligibleParticipantIds),
      ),
    );

  return rows
    .map((row) => ({
      attemptId: row.attemptId,
      participantId: row.participantId,
      shareCode: row.shareCode,
      score: {
        ...scoreFromStored(row.evaluation),
        evaluationsUsed: row.evaluationsUsed,
      },
      evaluatedAt: row.evaluation.createdAt,
    }))
    .sort(compareRankedChallengeEvaluations);
};

export const rankForAttempt = (
  ranked: ReadonlyArray<RankedEvaluation>,
  attemptId: string,
): { rank: number; competitorCount: number } | undefined => {
  const index = ranked.findIndex((row) => row.attemptId === attemptId);
  if (index < 0) return undefined;
  const ranks = competitionRanksForEvaluations(ranked);
  return { rank: ranks[index] ?? 1, competitorCount: ranked.length };
};

export const getChallengeRanking = async (
  slug: string,
  now: Date = currentChallengeTime(),
): Promise<ChallengeRanking> => {
  const challenge = challengeBySlug(slug);
  if (!challenge) {
    throw new HttpError(404, "CHALLENGE_NOT_FOUND", "Challenge not found");
  }

  const challengeItem = catalogItemFor(challenge, now, challengesForceOpen());
  if (!isChallengeRankingVisibleAt(challenge, now)) {
    return {
      challenge: challengeItem,
      entries: [],
      competitorCount: 0,
    };
  }

  const ranked = await rankedEvaluationsFor(slug);
  const participantIds = [...new Set(ranked.map((row) => row.participantId))];
  const identityByParticipant = new Map<
    string,
    {
      firstName: string | null;
      lastName: string | null;
      name: string | null;
      githubUrl: string | null;
      linkedInUrl: string | null;
    }
  >();

  if (participantIds.length > 0) {
    const applicationRows = await db
      .select({
        participantId: applications.participantId,
        firstName: applications.firstName,
        lastName: applications.lastName,
        name: participants.name,
        githubUrl: applications.githubUrl,
        linkedInUrl: applications.linkedInUrl,
      })
      .from(applications)
      .innerJoin(participants, eq(participants.id, applications.participantId))
      .where(inArray(applications.participantId, participantIds))
      .orderBy(desc(applications.createdAt), desc(applications.id));

    for (const application of applicationRows) {
      if (identityByParticipant.has(application.participantId)) continue;
      identityByParticipant.set(application.participantId, {
        firstName: application.firstName,
        lastName: application.lastName,
        name: application.name,
        githubUrl: application.githubUrl,
        linkedInUrl: application.linkedInUrl,
      });
    }
  }

  const ranks = competitionRanksForEvaluations(ranked);
  const publicRanked = publicRankingEntries(ranked);
  const entries: Array<ChallengeRankingEntry> = publicRanked.map(
    (row, index) => {
      const identity = identityByParticipant.get(row.participantId);
      const profileLinks = publicProfileLinksFor({
        githubUrl: identity?.githubUrl,
        linkedInUrl: identity?.linkedInUrl,
      });
      return {
        rank: ranks[index] ?? 1,
        displayName: rankingDisplayName({
          name: identity?.name,
          firstName: identity?.firstName,
          lastName: identity?.lastName,
        }),
        ...profileLinks,
        shareCode: row.shareCode,
        accuracy: row.score.accuracy,
        exactCount: row.score.exactCount,
        sampleSize: row.score.sampleSize,
        meanError: row.score.meanError,
        queriesUsed: row.score.queriesUsed,
        runtimeMs: row.score.runtimeMs,
        executionCost: row.score.executionCost,
        evaluatedAt: row.evaluatedAt.toISOString(),
      };
    },
  );

  return {
    challenge: challengeItem,
    entries,
    competitorCount: entries.length,
  };
};
