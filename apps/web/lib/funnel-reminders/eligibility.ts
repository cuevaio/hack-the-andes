import type { FunnelReminderStage } from "./types";

export interface FunnelProgress {
  readonly applicationStatus?: string;
  readonly applicationSubmitted: boolean;
  readonly challengeStarted: boolean;
  readonly challengeCompleted: boolean;
  readonly challengeFinishAvailable: boolean;
}

const challengeCandidateStatuses = new Set([
  "submitted",
  "under_review",
  "waitlisted",
]);

export const needsFunnelReminder = (
  stage: FunnelReminderStage,
  progress: FunnelProgress,
  challengeOpen = true,
): boolean => {
  if (stage === "registration") return !progress.applicationSubmitted;
  if (!challengeOpen) return false;

  const isActiveCandidate =
    progress.applicationSubmitted &&
    Boolean(
      progress.applicationStatus &&
        challengeCandidateStatuses.has(progress.applicationStatus),
    );
  if (!isActiveCandidate) return false;

  if (stage === "challenge_start") {
    return !progress.challengeStarted && !progress.challengeCompleted;
  }
  return (
    progress.challengeStarted &&
    !progress.challengeCompleted &&
    progress.challengeFinishAvailable
  );
};
