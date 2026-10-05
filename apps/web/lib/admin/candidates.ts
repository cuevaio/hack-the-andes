import { db } from "@chofex/db";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
  sql,
} from "@chofex/db/orm";
import {
  acceptanceDetails,
  applications,
  challengeAttempts,
  participantBadges,
  participants,
} from "@chofex/db/schema";
import { clerkClient } from "@clerk/nextjs/server";

import { storeAcceptanceBadgeProfile } from "@/lib/badges/acceptance";
import { enqueueBadgeGeneration } from "@/lib/badges/enqueue";
import { emailAddresses } from "@/lib/emails/config";
import { HttpError } from "@/lib/registration/http";
import {
  completedChallengeParticipantCondition,
  startedChallengeParticipantCondition,
} from "../challenges/metrics";
import { rankedEvaluationsFor } from "../challenges/ranking";
import {
  compareRankedChallengeEvaluations,
  competitionRanksForEvaluations,
} from "../challenges/ranking-policy";
import { challengeActivityForParticipants } from "../challenges/service";
import { participantHasLatestRankedChallengeResult } from "./admission-policy";
import { candidateAvatarUrl, candidateBadgePictureUrl } from "./avatars";
import type { CandidateFilters } from "./candidate-filters";
import { sortCandidatesByChallengeRanking } from "./candidate-ranking";
import { type ApplicationDecision, buildDecisionEmail } from "./decision-email";
import {
  candidateFunnelApplicationCondition,
  candidateFunnelStatusExpression,
  candidateFunnelStatusFor,
} from "./funnel-status";
import {
  type Candidate,
  type CandidateCounts,
  type CandidateDecisionResult,
  type CandidatePage,
  candidateFunnelStatuses,
  candidateRankingSorts,
  reviewableCandidateStatuses,
} from "./types";

const pageSize = 10;

const optional = <A>(value: A | null | undefined): A | undefined =>
  value ?? undefined;

const dateString = (value: Date | string): string => {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

const instantString = (value: Date | null | undefined): string | undefined => {
  if (!value) return undefined;
  return value.toISOString();
};

type ApplicationRecord = typeof applications.$inferSelect;
type DecidedApplication = ApplicationRecord & {
  readonly status: "accepted" | "rejected";
};
type DecisionRecord = {
  readonly application: DecidedApplication;
  readonly attemptNumber: number;
};
type ApplicationHistoryRecord = {
  readonly application: ApplicationRecord;
  readonly attemptNumber: number;
};

const isDecidedApplication = (
  application: ApplicationRecord,
): application is DecidedApplication =>
  application.status === "accepted" || application.status === "rejected";

type CandidateRecord = {
  readonly application: ApplicationRecord;
  readonly details: typeof acceptanceDetails.$inferSelect | null;
  readonly badge: typeof participantBadges.$inferSelect | null;
  readonly clerkUserId: string;
  readonly participantName: string | null;
  readonly participantLegalName: string | null;
  readonly countryCode: string | null;
  readonly participantCreatedAt: Date;
  readonly attemptNumber: number;
  readonly applicationHistory: ReadonlyArray<ApplicationHistoryRecord>;
  readonly decisionHistory: ReadonlyArray<DecisionRecord>;
};

const toCandidate = (
  record: CandidateRecord,
  clerkPictureUrl: string | undefined,
  clerkName: string | undefined,
  clerkCreatedAt: string | undefined,
  approvedBy: string | undefined,
  clerkNames: ReadonlyMap<string, string>,
  challenges: Candidate["challenges"],
  challengeHistory: Candidate["challengeHistory"],
): Candidate => {
  const { application, details } = record;
  const submittedAt = instantString(application.submittedAt);
  let dateOfBirth: string | undefined;
  if (details?.dateOfBirth) dateOfBirth = dateString(details.dateOfBirth);
  const decisionHistory = record.decisionHistory.map((decisionRecord) => {
    const decision = decisionRecord.application;
    const decidedAt = decision.decidedAt ?? decision.updatedAt;
    const reviewerId = decision.decidedByClerkUserId;
    let decidedBy: string | undefined;
    if (reviewerId) decidedBy = clerkNames.get(reviewerId) ?? reviewerId;
    return {
      applicationId: decision.id,
      attemptNumber: decisionRecord.attemptNumber,
      decision: decision.status,
      at: decidedAt.toISOString(),
      decidedBy,
      message: optional(decision.rejectionReason),
    };
  });
  const applicationHistory = record.applicationHistory.map(
    ({ application: attempt, attemptNumber }) => {
      let decidedAt: string | undefined;
      if (isDecidedApplication(attempt)) {
        decidedAt = (attempt.decidedAt ?? attempt.updatedAt).toISOString();
      }
      let withdrawnAt: string | undefined;
      if (attempt.status === "withdrawn") {
        withdrawnAt = attempt.updatedAt.toISOString();
      }
      return {
        applicationId: attempt.id,
        attemptNumber,
        status: attempt.status,
        startedAt: attempt.createdAt.toISOString(),
        submittedAt: instantString(attempt.submittedAt),
        decidedAt,
        withdrawnAt,
      };
    },
  );

  return {
    id: application.id,
    participantId: application.participantId,
    name:
      record.participantName ??
      clerkName ??
      [application.firstName, application.lastName].filter(Boolean).join(" "),
    firstName: application.firstName ?? "Unknown",
    lastName: application.lastName ?? "participant",
    email: application.email ?? "",
    avatarUrl: candidateAvatarUrl(
      optional(application.pictureUrl),
      clerkPictureUrl,
      application.githubUrl,
    ),
    badgePictureUrl: candidateBadgePictureUrl(
      optional(application.pictureUrl),
      clerkPictureUrl,
      application.githubUrl,
    ),
    pronouns: optional(application.pronouns),
    countryCode: optional(record.countryCode),
    city: optional(application.city),
    participationMode: optional(application.participationMode),
    organization: optional(application.organization),
    role: optional(application.role),
    applicationPhone: optional(application.phone),
    fieldOfStudy: optional(application.fieldOfStudy),
    graduationYear: optional(application.graduationYear),
    shippedProject: optional(application.shippedProject),
    hackathonProject: optional(application.hackathonProject),
    bio: optional(application.bio),
    githubUrl: optional(application.githubUrl),
    linkedInUrl: optional(application.linkedInUrl),
    portfolioUrl: optional(application.portfolioUrl),
    badgeUrl: optional(record.badge?.badgeUrl),
    teamPreference: optional(application.teamPreference),
    teamName: optional(application.teamName),
    status: application.status,
    funnelStatus: candidateFunnelStatusFor(
      application.status,
      submittedAt,
      challenges,
    ),
    mediaConsent: details?.mediaConsent ?? application.mediaConsent,
    signedUpAt: clerkCreatedAt ?? record.participantCreatedAt.toISOString(),
    createdAt: application.createdAt.toISOString(),
    submittedAt,
    decidedAt: instantString(application.decidedAt),
    approvedBy,
    attemptNumber: record.attemptNumber,
    applicationHistory,
    decisionHistory,
    documentFullName: optional(record.participantLegalName),
    phone: optional(details?.phone),
    dateOfBirth,
    shirtSize: optional(details?.shirtSize),
    dietaryRestrictions: optional(details?.dietaryRestrictions),
    accessibilityNeeds: optional(details?.accessibilityNeeds),
    emergencyContactName: optional(details?.emergencyContactName),
    emergencyContactPhone: optional(details?.emergencyContactPhone),
    attendanceCompletedAt: instantString(details?.completedAt),
    checkedInAt: instantString(details?.checkedInAt),
    nationalIdProvided: Boolean(details?.nationalIdNumber),
    challenges,
    challengeHistory,
  };
};

const toCandidates = async (
  records: ReadonlyArray<CandidateRecord>,
): Promise<ReadonlyArray<Candidate>> => {
  const participantIds = [
    ...new Set(records.map((record) => record.application.participantId)),
  ];
  const [clerk, challengeActivity] = await Promise.all([
    clerkClient(),
    challengeActivityForParticipants(participantIds),
  ]);
  const clerkUserIds = [
    ...new Set(records.map((record) => record.clerkUserId)),
  ];
  const reviewerIds = records.flatMap((record) =>
    record.decisionHistory.flatMap(({ application: decision }) => {
      const reviewerId = decision.decidedByClerkUserId;
      if (reviewerId) return [reviewerId];
      return [];
    }),
  );
  const approverIds = records.flatMap((record) => {
    if (record.application.status !== "accepted") return [];
    const approverId = record.application.decidedByClerkUserId;
    if (approverId) return [approverId];
    return [];
  });
  const allClerkUserIds = [
    ...new Set([...clerkUserIds, ...reviewerIds, ...approverIds]),
  ];
  const clerkPictures = new Map<string, string>();
  const clerkCreatedAt = new Map<string, string>();
  const clerkNames = new Map<string, string>();
  const clerkProfileNames = new Map<string, string>();

  await Promise.all(
    allClerkUserIds.map(async (clerkUserId) => {
      try {
        const user = await clerk.users.getUser(clerkUserId);
        if (user.hasImage) clerkPictures.set(clerkUserId, user.imageUrl);
        clerkCreatedAt.set(clerkUserId, new Date(user.createdAt).toISOString());
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
        if (name) clerkProfileNames.set(clerkUserId, name);
        const primaryEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId,
        )?.emailAddress;
        clerkNames.set(clerkUserId, name || primaryEmail || clerkUserId);
      } catch {
        // A missing Clerk user should not prevent admins from reviewing applications.
      }
    }),
  );

  await Promise.all(
    records.flatMap((record) => {
      if (record.participantName) return [];
      const name = clerkProfileNames.get(record.clerkUserId);
      if (!name) return [];
      return [
        db
          .update(participants)
          .set({ name, updatedAt: new Date() })
          .where(
            and(
              eq(participants.id, record.application.participantId),
              isNull(participants.name),
            ),
          ),
      ];
    }),
  );

  return records.map((record) => {
    let approvedBy: string | undefined;
    if (record.application.status === "accepted") {
      const approverId = record.application.decidedByClerkUserId;
      if (approverId) approvedBy = clerkNames.get(approverId) ?? approverId;
    }
    const participantId = record.application.participantId;
    return toCandidate(
      record,
      clerkPictures.get(record.clerkUserId),
      clerkProfileNames.get(record.clerkUserId),
      clerkCreatedAt.get(record.clerkUserId),
      approvedBy,
      clerkNames,
      challengeActivity.progressByParticipant.get(participantId) ?? [],
      challengeActivity.milestonesByParticipant.get(participantId) ?? [],
    );
  });
};

const addAttemptHistory = async <
  BaseRecord extends Omit<
    CandidateRecord,
    "attemptNumber" | "applicationHistory" | "decisionHistory"
  >,
>(
  records: ReadonlyArray<BaseRecord>,
): Promise<ReadonlyArray<CandidateRecord>> => {
  const participantIds = [
    ...new Set(records.map((record) => record.application.participantId)),
  ];
  if (participantIds.length === 0) return [];

  const history = await db
    .select()
    .from(applications)
    .where(inArray(applications.participantId, participantIds))
    .orderBy(desc(applications.createdAt), desc(applications.id));
  const historyByParticipant = new Map<string, Array<ApplicationRecord>>();
  for (const application of history) {
    const existing = historyByParticipant.get(application.participantId) ?? [];
    existing.push(application);
    historyByParticipant.set(application.participantId, existing);
  }

  return records.map((record) => {
    const attempts =
      historyByParticipant.get(record.application.participantId) ?? [];
    const applicationHistory = attempts.map((attempt, index) => ({
      application: attempt,
      attemptNumber: attempts.length - index,
    }));
    return {
      ...record,
      attemptNumber: attempts.length,
      applicationHistory,
      decisionHistory: applicationHistory.flatMap((attemptRecord) => {
        const application = attemptRecord.application;
        if (!isDecidedApplication(application)) return [];
        return [{ application, attemptNumber: attemptRecord.attemptNumber }];
      }),
    };
  });
};

const candidateRecordById = async (
  applicationId: string,
): Promise<CandidateRecord | undefined> => {
  const [record] = await db
    .select({
      application: applications,
      details: acceptanceDetails,
      badge: participantBadges,
      clerkUserId: participants.clerkUserId,
      participantName: participants.name,
      participantLegalName: participants.legalName,
      countryCode: participants.countryCode,
      participantCreatedAt: participants.createdAt,
    })
    .from(applications)
    .innerJoin(participants, eq(participants.id, applications.participantId))
    .leftJoin(
      acceptanceDetails,
      eq(acceptanceDetails.applicationId, applications.id),
    )
    .leftJoin(
      participantBadges,
      eq(participantBadges.applicationId, applications.id),
    )
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!record) return undefined;
  const [candidateRecord] = await addAttemptHistory([record]);
  return candidateRecord;
};

type MutableCandidateCounts = {
  -readonly [Key in keyof CandidateCounts]: number;
};

const emptyCounts = (): MutableCandidateCounts => {
  const entries: Array<[keyof CandidateCounts, number]> = [["all", 0]];
  for (const status of candidateFunnelStatuses) entries.push([status, 0]);
  return Object.fromEntries(entries) as MutableCandidateCounts;
};

export const listCandidates = async (
  input: CandidateFilters,
): Promise<CandidatePage> => {
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1));
  const search = input.query?.trim();
  let rankingSlug = input.ranking;
  if (input.view === "ranking" && !rankingSlug) {
    rankingSlug = candidateRankingSorts[0];
  }
  const ranked = rankingSlug ? await rankedEvaluationsFor(rankingSlug) : [];
  ranked.sort((left, right) => {
    const order = compareRankedChallengeEvaluations(left, right);
    if (order !== 0) return order;
    return left.participantId.localeCompare(right.participantId);
  });
  const ranks = competitionRanksForEvaluations(ranked);
  const rankingByParticipant = new Map(
    ranked.map((entry, index) => [
      entry.participantId,
      { ...entry, rank: ranks[index] ?? 1 },
    ]),
  );
  let rankingCondition: SQL | undefined;
  if (input.view === "ranking") {
    rankingCondition = inArray(
      applications.participantId,
      ranked.map((entry) => entry.participantId),
    );
  }
  let searchCondition: SQL | undefined;
  if (search) {
    const terms = search.split(/\s+/);
    searchCondition = and(
      ...terms.map((term) => {
        const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
        return or(
          ilike(applications.firstName, pattern),
          ilike(applications.lastName, pattern),
          ilike(participants.name, pattern),
          ilike(applications.email, pattern),
          ilike(applications.organization, pattern),
          ilike(applications.githubUrl, pattern),
          ilike(applications.linkedInUrl, pattern),
          ilike(sql`${applications.id}::text`, pattern),
          sql`exists (
            select 1 from ${challengeAttempts}
            where ${challengeAttempts.participantId} = ${applications.participantId}
              and ${ilike(challengeAttempts.shareCode, pattern)}
          )`,
        );
      }),
    );
  }
  const funnelStatus = candidateFunnelStatusExpression();
  let countryCondition: SQL | undefined;
  if (input.country?.kind === "unknown") {
    countryCondition = isNull(participants.countryCode);
  } else if (input.country?.kind === "country") {
    countryCondition = eq(participants.countryCode, input.country.code);
  } else if (input.country?.kind === "outside_peru") {
    countryCondition = sql`${participants.countryCode} <> 'PE'`;
  }
  const visibleInFunnel = candidateFunnelApplicationCondition();
  let challengeCondition: SQL | undefined;
  if (input.challenge) {
    challengeCondition = startedChallengeParticipantCondition(
      sql`${applications.participantId}`,
      input.challenge,
    );
  }
  let statusCondition: SQL | undefined;
  if (input.status) statusCondition = sql`${funnelStatus} = ${input.status}`;
  const latestApplications = db
    .selectDistinctOn([applications.participantId], { id: applications.id })
    .from(applications)
    .orderBy(
      applications.participantId,
      desc(applications.createdAt),
      desc(applications.id),
    )
    .as("latest_applications");
  const funnelSummary = db
    .select({
      status: funnelStatus.as("status"),
      submitted: sql<boolean>`${applications.submittedAt} is not null`.as(
        "submitted",
      ),
      started: startedChallengeParticipantCondition(
        sql`${applications.participantId}`,
        input.challenge,
      ).as("started"),
      completed: completedChallengeParticipantCondition(
        sql`${applications.participantId}`,
        input.challenge,
      ).as("completed"),
    })
    .from(applications)
    .innerJoin(latestApplications, eq(latestApplications.id, applications.id))
    .innerJoin(participants, eq(participants.id, applications.participantId))
    .where(
      and(
        visibleInFunnel,
        searchCondition,
        countryCondition,
        challengeCondition,
        rankingCondition,
      ),
    )
    .as("funnel_summary");
  const whereCondition = and(
    visibleInFunnel,
    searchCondition,
    countryCondition,
    challengeCondition,
    statusCondition,
    rankingCondition,
  );

  const [totalResult, statusResults] = await Promise.all([
    db
      .select({ value: count() })
      .from(applications)
      .innerJoin(latestApplications, eq(latestApplications.id, applications.id))
      .innerJoin(participants, eq(participants.id, applications.participantId))
      .where(whereCondition),
    db
      .select({
        status: funnelSummary.status,
        value: count(),
        submitted: sql<number>`count(*) filter (where ${funnelSummary.submitted})::integer`,
        started: sql<number>`count(*) filter (where ${funnelSummary.started})::integer`,
        completed: sql<number>`count(*) filter (where ${funnelSummary.completed})::integer`,
      })
      .from(funnelSummary)
      .groupBy(funnelSummary.status),
  ]);

  const total = totalResult[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const candidateRecordsQuery = (condition: SQL | undefined) =>
    db
      .select({
        application: applications,
        details: acceptanceDetails,
        badge: participantBadges,
        clerkUserId: participants.clerkUserId,
        participantName: participants.name,
        participantLegalName: participants.legalName,
        countryCode: participants.countryCode,
        participantCreatedAt: participants.createdAt,
      })
      .from(applications)
      .innerJoin(latestApplications, eq(latestApplications.id, applications.id))
      .innerJoin(participants, eq(participants.id, applications.participantId))
      .leftJoin(
        acceptanceDetails,
        eq(acceptanceDetails.applicationId, applications.id),
      )
      .leftJoin(
        participantBadges,
        eq(participantBadges.applicationId, applications.id),
      )
      .where(condition);

  const offset = (currentPage - 1) * pageSize;
  let records: ReadonlyArray<
    Awaited<ReturnType<typeof candidateRecordsQuery>>[number]
  >;
  if (rankingSlug) {
    const candidateReferences = await db
      .select({
        id: applications.id,
        participantId: applications.participantId,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .innerJoin(latestApplications, eq(latestApplications.id, applications.id))
      .innerJoin(participants, eq(participants.id, applications.participantId))
      .where(whereCondition)
      .orderBy(desc(applications.createdAt));
    const pageReferences = sortCandidatesByChallengeRanking(
      candidateReferences,
      ranked.map((entry) => entry.participantId),
    ).slice(offset, offset + pageSize);
    const pageApplicationIds = pageReferences.map((record) => record.id);
    const pageRecords = await candidateRecordsQuery(
      and(whereCondition, inArray(applications.id, pageApplicationIds)),
    );
    const recordByApplicationId = new Map(
      pageRecords.map((record) => [record.application.id, record]),
    );
    records = pageApplicationIds.flatMap((applicationId) => {
      const record = recordByApplicationId.get(applicationId);
      if (record) return [record];
      return [];
    });
  } else {
    records = await candidateRecordsQuery(whereCondition)
      .orderBy(desc(applications.createdAt))
      .limit(pageSize)
      .offset(offset);
  }

  const counts = emptyCounts();
  const funnel = { submitted: 0, challengeStarted: 0, challengeCompleted: 0 };
  for (const result of statusResults) {
    counts[result.status] = result.value;
    counts.all += result.value;
    funnel.submitted += result.submitted;
    funnel.challengeStarted += result.started;
    funnel.challengeCompleted += result.completed;
  }

  const candidates = (await toCandidates(await addAttemptHistory(records))).map(
    (candidate) => {
      const result = rankingByParticipant.get(candidate.participantId);
      if (!result || !rankingSlug) return candidate;
      return {
        ...candidate,
        rankingResult: {
          slug: rankingSlug,
          rank: result.rank,
          score: result.score,
          evaluatedAt: result.evaluatedAt.toISOString(),
        },
      };
    },
  );
  let ranking: CandidatePage["ranking"];
  if (input.view === "ranking" && rankingSlug) {
    ranking = {
      slug: rankingSlug,
      competitorCount: ranked.length,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    candidates,
    counts,
    funnel,
    page: currentPage,
    pageSize,
    total,
    totalPages,
    ranking,
  };
};

export interface CandidateDecisionInput {
  readonly applicationId: string;
  readonly decision: ApplicationDecision;
  readonly message?: string;
  readonly notify: boolean;
  readonly decidedByClerkUserId: string;
}

const sendRejectionEmail = async (
  candidate: Candidate,
  message: string | undefined,
): Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: string }
> => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Resend is not configured" };
  }
  if (!candidate.email) {
    return { ok: false, error: "Candidate does not have an email address" };
  }

  const email = buildDecisionEmail({
    decision: "rejected",
    firstName: candidate.firstName,
    message,
  });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `application-decision/${candidate.id}/rejected`,
    },
    body: JSON.stringify({
      ...emailAddresses,
      to: [candidate.email],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => undefined)) as
      | { readonly message?: string }
      | undefined;
    return {
      ok: false,
      error: error?.message ?? `Resend returned HTTP ${response.status}`,
    };
  }
  return { ok: true };
};

export const decideCandidate = async (
  input: CandidateDecisionInput,
): Promise<CandidateDecisionResult> => {
  const message = input.message?.trim() || undefined;
  if (message && message.length > 2_000) {
    throw new HttpError(
      422,
      "MESSAGE_TOO_LONG",
      "The optional message must be 2,000 characters or fewer",
    );
  }

  if (input.decision === "accepted") {
    const [application] = await db
      .select({ participantId: applications.participantId })
      .from(applications)
      .where(eq(applications.id, input.applicationId))
      .limit(1);
    if (!application) {
      throw new HttpError(
        404,
        "APPLICATION_NOT_FOUND",
        "Application not found",
      );
    }
    const hasRankedResult = await participantHasLatestRankedChallengeResult(
      application.participantId,
    );
    if (!hasRankedResult) {
      throw new HttpError(
        409,
        "CHALLENGE_RESULT_REQUIRED",
        "A ranked result from the latest technical challenge version is required before acceptance",
      );
    }
  }

  const [updatedApplication] = await db
    .update(applications)
    .set({
      status: input.decision,
      decidedAt: new Date(),
      decidedByClerkUserId: input.decidedByClerkUserId,
      rejectionReason: input.decision === "rejected" ? message : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(applications.id, input.applicationId),
        inArray(applications.status, [...reviewableCandidateStatuses]),
      ),
    )
    .returning();

  const record = await candidateRecordById(input.applicationId);
  if (!record) {
    throw new HttpError(404, "APPLICATION_NOT_FOUND", "Application not found");
  }
  if (!updatedApplication) {
    const isSameDecision = record.application.status === input.decision;
    const isSameReviewer =
      record.application.decidedByClerkUserId === input.decidedByClerkUserId;
    if (!isSameDecision || !isSameReviewer) {
      throw new HttpError(
        409,
        "APPLICATION_NOT_REVIEWABLE",
        "This application has already been decided or is not ready for review",
      );
    }
  }
  const [candidate] = await toCandidates([record]);
  if (!candidate) throw new Error("Candidate conversion returned no result");

  let badgeStatus: CandidateDecisionResult["badgeStatus"] = "not_requested";
  let badgeError: string | undefined;
  if (input.decision === "accepted") {
    const shouldInitialize = Boolean(updatedApplication) || !record.badge;
    const shouldEnqueue =
      shouldInitialize || !record.badge || record.badge.status === "failed";
    try {
      if (shouldInitialize) await storeAcceptanceBadgeProfile(candidate);
      if (shouldEnqueue) {
        await enqueueBadgeGeneration(candidate.id, {
          force: true,
          notification: { kind: "acceptance", message },
        });
        badgeStatus = "pending";
      } else {
        badgeStatus = record.badge?.status ?? "pending";
      }
    } catch (error) {
      console.error("Acceptance badge generation could not start", error);
      badgeStatus = "failed";
      badgeError =
        "La decisión se guardó, pero no se pudo iniciar la generación del carnet";
    }

    if (badgeStatus === "failed") {
      return {
        candidate,
        emailStatus: "failed",
        emailError:
          "La decisión se guardó, pero el correo no puede enviarse hasta generar el carnet",
        badgeStatus,
        badgeError,
      };
    }

    const emailStatus = record.badge?.notificationSentAt ? "sent" : "pending";
    return { candidate, emailStatus, badgeStatus, badgeError };
  }

  if (!input.notify) {
    return { candidate, emailStatus: "not_requested", badgeStatus };
  }

  try {
    const email = await sendRejectionEmail(candidate, message);
    if (email.ok) {
      return { candidate, emailStatus: "sent", badgeStatus, badgeError };
    }
    return {
      candidate,
      emailStatus: "failed",
      emailError: email.error,
      badgeStatus,
      badgeError,
    };
  } catch (error) {
    console.error("Decision email failed", error);
    return {
      candidate,
      emailStatus: "failed",
      emailError: "The decision was saved, but the email could not be sent",
      badgeStatus,
      badgeError,
    };
  }
};
