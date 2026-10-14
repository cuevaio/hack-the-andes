export const gameLikesCheckedAt = "2026-10-14T16:19:00Z";

// Counts read from the linked posts in the browser. LinkedIn includes all reactions.
export const gamePostLikes = new Map<string, number>([
  ["https://vt.tiktok.com/ZSbWe2jXT/", 74],
  ["https://lnkd.in/p/eu8-2dYF", 15],
  ["https://x.com/AlexanderO73639/status/2108345937550544979", 2],
  ["https://www.youtube.com/watch?v=EgTdAntCf6k", 2],
  ["https://lnkd.in/p/dKbGRM2H", 17],
  [
    "https://www.linkedin.com/feed/update/urn:li:ugcPost:7515099931368521728/",
    35,
  ],
  ["https://lnkd.in/p/epS5WFKp", 56],
  ["https://x.com/binnicordova/status/2109418794842312800?s=46", 1],
  ["https://lnkd.in/p/devXPAmv", 9],
  ["https://lnkd.in/p/dehPd2r4", 7],
  ["https://lnkd.in/p/d4CRUJ-H", 86],
  ["https://lnkd.in/p/eaqtGx2C", 53],
  ["https://lnkd.in/p/dVytzWnu", 4],
  ["https://lnkd.in/p/ectUqxsp", 6],
  ["https://vt.tiktok.com/ZSgJNjfLV", 14],
]);

export function rankGames<T extends { links: { url: string }[] }>(games: T[]) {
  const sorted = games
    .map((game) => {
      const counts = game.links.flatMap(({ url }) => {
        const count = gamePostLikes.get(url);
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
