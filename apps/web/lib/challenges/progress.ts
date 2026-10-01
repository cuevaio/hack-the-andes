import type { ParticipantChallengeProgress } from "@chofex/challenges-contract";

export const challengeProgressStatus = (input: {
  readonly hasPersistedEvaluation: boolean;
  readonly hasAttempt: boolean;
}): ParticipantChallengeProgress["status"] => {
  if (input.hasPersistedEvaluation) return "evaluated";
  if (input.hasAttempt) return "in_progress";
  return "not_started";
};

export const challengeCompletionDurationMs = (
  attemptStartedAt: Date,
  completedAt: Date,
): number => Math.max(0, completedAt.getTime() - attemptStartedAt.getTime());

export const earliestChallengeCompletionAt = (
  current: Date | undefined,
  candidate: Date,
): Date => {
  if (!current || candidate < current) return candidate;
  return current;
};
