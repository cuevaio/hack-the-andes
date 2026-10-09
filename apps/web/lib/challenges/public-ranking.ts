import { getChallengeRanking } from "./ranking";
import { createPublicRankingCache } from "./ranking-cache";

export const getPublicChallengeRanking = createPublicRankingCache({
  load: getChallengeRanking,
});
