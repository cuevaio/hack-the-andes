import {
  type ChallengeRanking,
  challengeBySlug,
} from "@chofex/challenges-contract";

import { HttpError } from "../registration/http";

type CachedRanking =
  | { kind: "pending"; promise: Promise<ChallengeRanking> }
  | { kind: "ready"; data: ChallengeRanking; expiresAt: number };

// Cache public data only. Admission and placement checks continue to read live data.
export const createPublicRankingCache = ({
  load,
  now = () => performance.now(),
}: {
  load: (slug: string) => Promise<ChallengeRanking>;
  now?: () => number;
}): ((slug: string) => Promise<ChallengeRanking>) => {
  const entries = new Map<string, CachedRanking>();

  return async (slug) => {
    // Restrict keys to the finite catalog before allocating cache entries.
    if (!challengeBySlug(slug)) {
      throw new HttpError(404, "CHALLENGE_NOT_FOUND", "Challenge not found");
    }
    const cached = entries.get(slug);
    if (cached?.kind === "pending") return cached.promise;
    if (cached?.kind === "ready" && now() < cached.expiresAt) {
      return cached.data;
    }

    const promise = load(slug)
      .then((data) => {
        entries.set(slug, { kind: "ready", data, expiresAt: now() + 5_000 });
        return data;
      })
      .catch((error: unknown) => {
        entries.delete(slug);
        throw error;
      });
    entries.set(slug, { kind: "pending", promise });
    return promise;
  };
};
