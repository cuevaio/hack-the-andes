import { expect, test } from "bun:test";
import {
  type ChallengeRanking,
  challengeBySlug,
} from "@chofex/challenges-contract";

import { HttpError, jsonSuccess, withApiHandler } from "../registration/http";
import { catalogItemFor } from "./catalog";
import { createPublicRankingCache } from "./ranking-cache";

const rankingFor = (slug: string): ChallengeRanking => {
  const challenge = challengeBySlug(slug);
  if (!challenge) throw new Error(`Missing challenge ${slug}`);
  return {
    challenge: catalogItemFor(challenge),
    entries: [],
    competitorCount: 0,
  };
};

test("500 simultaneous public reads share one load and keep request IDs separate", async () => {
  let calls = 0;
  const result = rankingFor("black-box");
  const deferred = Promise.withResolvers<ChallengeRanking>();
  const read = createPublicRankingCache({
    load: () => {
      calls += 1;
      return deferred.promise;
    },
  });
  const requests = Array.from({ length: 500 }, (_, index) => {
    const request = new Request(
      "http://localhost/api/v1/challenges/black-box/ranking",
      {
        headers: { "x-request-id": `request_${index}` },
      },
    );
    return withApiHandler(request, async (requestId) =>
      jsonSuccess(requestId, await read("black-box")),
    );
  });
  expect(calls).toBe(1);
  deferred.resolve(result);
  const responses = await Promise.all(requests);
  for (const [index, response] of responses.entries()) {
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      version: 1,
      ok: true,
      requestId: `request_${index}`,
      data: result,
    });
  }
  await read("black-box");
  expect(calls).toBe(1);
});

test("refreshes at five seconds after completion and shares the refresh", async () => {
  let clock = 0;
  let calls = 0;
  const deferred = Promise.withResolvers<ChallengeRanking>();
  const read = createPublicRankingCache({
    now: () => clock,
    load: () => {
      calls += 1;
      if (calls === 1) return deferred.promise;
      return Promise.resolve({
        ...rankingFor("black-box"),
        competitorCount: 1,
      });
    },
  });
  const first = read("black-box");
  clock = 10_000;
  deferred.resolve(rankingFor("black-box"));
  await first;
  clock = 14_999;
  expect((await read("black-box")).competitorCount).toBe(0);
  clock = 15_000;
  const refreshed = await Promise.all(
    Array.from({ length: 100 }, () => read("black-box")),
  );
  expect(calls).toBe(2);
  expect(refreshed.every((result) => result.competitorCount === 1)).toBe(true);
});

test("keeps challenge caches separate and rejects unknown slugs without loading", async () => {
  const calls: string[] = [];
  const read = createPublicRankingCache({
    load: async (slug) => {
      calls.push(slug);
      return rankingFor(slug);
    },
  });
  const results = await Promise.all([read("black-box"), read("broken-agent")]);
  expect(results.map((result) => result.challenge.slug)).toEqual([
    "black-box",
    "broken-agent",
  ]);
  await expect(read("unknown")).rejects.toBeInstanceOf(HttpError);
  expect(calls).toEqual(["black-box", "broken-agent"]);
});

test("shares failures with waiting callers and retries on the next request", async () => {
  let calls = 0;
  const read = createPublicRankingCache({
    load: async () => {
      calls += 1;
      if (calls === 1) throw new Error("Database unavailable");
      return rankingFor("black-box");
    },
  });
  const results = await Promise.allSettled([
    read("black-box"),
    read("black-box"),
  ]);
  expect(results.every((result) => result.status === "rejected")).toBe(true);
  expect(calls).toBe(1);
  expect(await read("black-box")).toEqual(rankingFor("black-box"));
  expect(calls).toBe(2);
});
