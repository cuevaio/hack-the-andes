import {
  brokenAgentChallengeSlug,
  type ChallengeScore,
  compareChallengeScores,
} from "@chofex/challenges-contract";
import { slowServiceChallengeSlug } from "@chofex/challenges-contract/slow-service";

const publicRankingEntryLimit = 17;

export const publicRankingEntries = <
  Entry extends Pick<ChallengeScore, "accuracy">,
>({
  slug,
  ranked,
}: {
  readonly slug: string;
  readonly ranked: ReadonlyArray<Entry>;
}): Array<Entry> => {
  if (slug === brokenAgentChallengeSlug) {
    return ranked.filter((entry) => entry.accuracy >= 0.95);
  }
  if (slug === slowServiceChallengeSlug) return [...ranked];
  return ranked.slice(0, publicRankingEntryLimit);
};

export const competitionRanks = (
  scores: ReadonlyArray<ChallengeScore>,
): Array<number> =>
  competitionRanksBy(scores, (previous, score) =>
    compareChallengeScores(previous, score),
  );

export const competitionRanksBy = <Entry>(
  entries: ReadonlyArray<Entry>,
  compare: (left: Entry, right: Entry) => number,
): Array<number> => {
  const ranks: Array<number> = [];
  let currentRank = 1;

  for (const [index, entry] of entries.entries()) {
    const previous = entries[index - 1];
    if (previous && compare(previous, entry) !== 0) {
      currentRank = index + 1;
    }
    ranks.push(currentRank);
  }

  return ranks;
};

export interface EvaluatedChallengeScore {
  readonly score: ChallengeScore;
  readonly evaluatedAt: Date;
}

export const compareRankedChallengeEvaluations = (
  left: EvaluatedChallengeScore,
  right: EvaluatedChallengeScore,
): number => {
  if (
    left.score.challengeSlug === slowServiceChallengeSlug &&
    right.score.challengeSlug === slowServiceChallengeSlug
  ) {
    const pointsOrder = right.score.accuracy - left.score.accuracy;
    if (pointsOrder !== 0) return pointsOrder;
    const submissionOrder =
      left.evaluatedAt.getTime() - right.evaluatedAt.getTime();
    if (submissionOrder !== 0) return submissionOrder;
    return compareChallengeScores(left.score, right.score);
  }
  const scoreOrder = compareChallengeScores(left.score, right.score);
  if (scoreOrder !== 0) return scoreOrder;
  if (left.score.breakdown && right.score.breakdown) {
    return left.evaluatedAt.getTime() - right.evaluatedAt.getTime();
  }
  return 0;
};

export const competitionRanksForEvaluations = (
  ranked: ReadonlyArray<EvaluatedChallengeScore>,
): Array<number> =>
  competitionRanksBy(ranked, compareRankedChallengeEvaluations);
