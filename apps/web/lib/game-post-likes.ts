export const gameLikesCheckedAt = "2026-10-15T03:56:57Z";

export const previousGameLikesCheckedAt = "2026-10-14T16:19:00Z";
export const gamePostLikesNeedRecheck = new Set([
  "https://vt.tiktok.com/ZSbWe2jXT/",
  "https://vt.tiktok.com/ZSgJNjfLV",
]);

// Counts read from the linked posts in the browser. LinkedIn includes all reactions.
export const gamePostLikes = new Map<string, number>([
  ["https://vt.tiktok.com/ZSbWe2jXT/", 74],
  ["https://lnkd.in/p/eu8-2dYF", 15],
  ["https://x.com/AlexanderO73639/status/2108345937550544979", 2],
  ["https://www.youtube.com/watch?v=EgTdAntCf6k", 2],
  ["https://lnkd.in/p/dKbGRM2H", 18],
  [
    "https://www.linkedin.com/feed/update/urn:li:ugcPost:7515099931368521728/",
    39,
  ],
  ["https://lnkd.in/p/epS5WFKp", 57],
  ["https://x.com/binnicordova/status/2109418794842312800?s=46", 1],
  ["https://lnkd.in/p/devXPAmv", 9],
  ["https://lnkd.in/p/dehPd2r4", 7],
  ["https://lnkd.in/p/d4CRUJ-H", 102],
  ["https://lnkd.in/p/eaqtGx2C", 69],
  ["https://lnkd.in/p/dVytzWnu", 7],
  ["https://lnkd.in/p/ectUqxsp", 6],
  ["https://vt.tiktok.com/ZSgJNjfLV", 14],
  [
    "https://www.linkedin.com/feed/update/urn:li:activity:7516041882490142720/",
    30,
  ],
  ["https://www.instagram.com/p/DeecQ9vG2Ct/", 1],
  ["https://lnkd.in/p/e4VDQCrU", 5],
  [
    "https://www.linkedin.com/feed/update/urn:li:activity:7516185183210037248/",
    17,
  ],
  ["https://lnkd.in/p/eakSQ98F", 52],
  [
    "https://www.linkedin.com/posts/hector-zerrillo_hacktheandes-gamedev-pixelart-share-7515546680428027904-lBgS/",
    10,
  ],
  [
    "https://www.linkedin.com/feed/update/urn:li:activity:7516319431329804289/",
    4,
  ],
  ["https://lnkd.in/p/eq2zWU38", 6],
  ["https://lnkd.in/p/e3dWzHRF", 0],
  ["https://x.com/_moonliit_/status/2110568623454474444", 1],
]);

export function rankGames<T extends { links: { url: string }[] }>(
  games: T[],
  postLikes: ReadonlyMap<string, number> = gamePostLikes,
) {
  const sorted = games
    .map((game) => {
      const counts = game.links.flatMap(({ url }) => {
        const count = postLikes.get(url);
        return count === undefined ? [] : [count];
      });
      let likes: number | null = null;
      if (counts.length > 0) likes = Math.max(...counts);
      return { ...game, likes };
    })
    .sort((a, b) => (b.likes ?? -1) - (a.likes ?? -1));

  return sorted.map((game) => {
    let rank: number | null = null;
    if (game.likes !== null) {
      rank = sorted.findIndex((entry) => entry.likes === game.likes) + 1;
    }
    return { ...game, rank };
  });
}
