import type {
  ChallengeScore,
  ParticipantChallengeMilestone,
  ParticipantChallengeProgress,
} from "@chofex/challenges-contract";
import { playableChallenges } from "@chofex/challenges-contract";

export const candidateStatuses = [
  "draft",
  "submitted",
  "under_review",
  "waitlisted",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

export type CandidateStatus = (typeof candidateStatuses)[number];

export const candidateFunnelStatuses = [
  "registration_started",
  "registration_completed",
  "challenge_started",
  "challenge_completed",
  "approved",
  "declined",
] as const;

export const candidateFilters = candidateFunnelStatuses;

export type CandidateFunnelStatus = (typeof candidateFunnelStatuses)[number];

export type CandidateFilter = CandidateFunnelStatus;

export const parseCandidateFilter = (
  value: string | undefined,
): CandidateFilter | undefined =>
  candidateFilters.find((candidate) => candidate === value);

export const candidateRankingSorts = playableChallenges.map(
  (challenge) => challenge.slug,
);

export type CandidateRankingSort = (typeof candidateRankingSorts)[number];

export const parseCandidateRankingSort = (
  value: string | undefined,
): CandidateRankingSort | undefined =>
  candidateRankingSorts.find((challenge) => challenge === value);

export const reviewableCandidateStatuses: ReadonlyArray<CandidateStatus> = [
  "submitted",
  "under_review",
  "waitlisted",
];

export interface Candidate {
  readonly id: string;
  readonly participantId: string;
  readonly name: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly avatarUrl?: string;
  readonly badgePictureUrl?: string;
  readonly pronouns?: string;
  readonly countryCode?: string;
  readonly city?: string;
  readonly participationMode?: "in_person" | "remote";
  readonly organization?: string;
  readonly role?: string;
  readonly applicationPhone?: string;
  readonly fieldOfStudy?: string;
  readonly graduationYear?: number;
  readonly shippedProject?: string;
  readonly hackathonProject?: string;
  readonly bio?: string;
  readonly githubUrl?: string;
  readonly linkedInUrl?: string;
  readonly portfolioUrl?: string;
  readonly badgeUrl?: string;
  readonly teamPreference?: "have_team" | "looking_for_team" | "solo";
  readonly teamName?: string;
  readonly status: CandidateStatus;
  readonly funnelStatus: CandidateFunnelStatus;
  readonly mediaConsent: boolean;
  readonly signedUpAt: string;
  readonly createdAt: string;
  readonly submittedAt?: string;
  readonly decidedAt?: string;
  readonly approvedBy?: string;
  readonly attemptNumber: number;
  readonly applicationHistory: ReadonlyArray<{
    readonly applicationId: string;
    readonly attemptNumber: number;
    readonly status: CandidateStatus;
    readonly startedAt: string;
    readonly submittedAt?: string;
    readonly decidedAt?: string;
    readonly withdrawnAt?: string;
  }>;
  readonly decisionHistory: ReadonlyArray<{
    readonly applicationId: string;
    readonly attemptNumber: number;
    readonly decision: "accepted" | "rejected";
    readonly at: string;
    readonly decidedBy?: string;
    readonly message?: string;
  }>;
  readonly documentFullName?: string;
  readonly phone?: string;
  readonly dateOfBirth?: string;
  readonly shirtSize?: string;
  readonly dietaryRestrictions?: string;
  readonly accessibilityNeeds?: string;
  readonly emergencyContactName?: string;
  readonly emergencyContactPhone?: string;
  readonly attendanceCompletedAt?: string;
  readonly checkedInAt?: string;
  readonly nationalIdProvided: boolean;
  readonly challenges: ReadonlyArray<ParticipantChallengeProgress>;
  readonly challengeHistory: ReadonlyArray<ParticipantChallengeMilestone>;
  readonly rankingResult?: {
    readonly slug: CandidateRankingSort;
    readonly rank: number;
    readonly score: ChallengeScore;
    readonly evaluatedAt: string;
  };
}

export type CandidateCounts = Readonly<
  { readonly all: number } & Record<CandidateFunnelStatus, number>
>;

export interface CandidatePage {
  readonly candidates: ReadonlyArray<Candidate>;
  readonly counts: CandidateCounts;
  readonly funnel: {
    readonly submitted: number;
    readonly challengeStarted: number;
    readonly challengeCompleted: number;
  };
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly ranking?: {
    readonly slug: CandidateRankingSort;
    readonly competitorCount: number;
    readonly updatedAt: string;
  };
}

export interface CandidateDecisionResult {
  readonly candidate: Candidate;
  readonly emailStatus: "not_requested" | "pending" | "sent" | "failed";
  readonly emailError?: string;
  readonly badgeStatus:
    | "not_requested"
    | "pending"
    | "running"
    | "completed"
    | "failed";
  readonly badgeError?: string;
}
