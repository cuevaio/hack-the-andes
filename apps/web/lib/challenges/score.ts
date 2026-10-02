import type {
  ChallengeScore,
  ChallengeScoreBreakdown,
} from "@chofex/challenges-contract";
import { slowServiceChallengeSlug } from "@chofex/challenges-contract/slow-service";

export interface StoredChallengeScore {
  readonly accuracy: number;
  readonly exactCount: number;
  readonly sampleSize: number;
  readonly meanError: number;
  readonly queriesUsed: number;
  readonly runtimeMs: number;
  readonly executionCost?: number | null;
  readonly solution?: unknown;
}

const scoreBreakdownFrom = (
  solution: unknown,
): ChallengeScoreBreakdown | undefined => {
  if (!solution || typeof solution !== "object" || Array.isArray(solution)) {
    return;
  }
  const breakdown = (solution as Record<string, unknown>).scoreBreakdown;
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) {
    return;
  }
  return breakdown as ChallengeScoreBreakdown;
};

export const scoreFromStored = (
  score: StoredChallengeScore,
): ChallengeScore => {
  const stored = {
    accuracy: score.accuracy,
    exactCount: score.exactCount,
    sampleSize: score.sampleSize,
    meanError: score.meanError,
    queriesUsed: score.queriesUsed,
    runtimeMs: score.runtimeMs,
  };
  const breakdown = scoreBreakdownFrom(score.solution);
  if (
    score.solution &&
    typeof score.solution === "object" &&
    "challengeSlug" in score.solution &&
    score.solution.challengeSlug === slowServiceChallengeSlug
  ) {
    return {
      ...stored,
      executionCost: score.executionCost ?? undefined,
      challengeSlug: slowServiceChallengeSlug,
    };
  }
  if (
    breakdown &&
    score.executionCost !== null &&
    score.executionCost !== undefined
  ) {
    return { ...stored, breakdown, executionCost: score.executionCost };
  }
  if (breakdown) return { ...stored, breakdown };
  return stored;
};

export const formatChallengeScore = (accuracy: number): string =>
  `${(accuracy * 100).toFixed(2)}%`;

export const participantVisibleScore = (
  score: ChallengeScore,
): ChallengeScore => {
  const visible: ChallengeScore = {
    accuracy: score.accuracy,
    exactCount: score.exactCount,
    sampleSize: score.sampleSize,
    meanError: score.meanError,
    queriesUsed: score.queriesUsed,
    runtimeMs: score.runtimeMs,
  };
  if (score.challengeSlug === slowServiceChallengeSlug)
    return { ...visible, executionCost: score.executionCost };
  if (score.evaluationsUsed !== undefined) {
    return { ...visible, evaluationsUsed: score.evaluationsUsed };
  }
  return visible;
};
