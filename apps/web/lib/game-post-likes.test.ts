import { expect, test } from "bun:test";
import { rankGames } from "./game-post-likes";

test("ranks by the strongest verified post, shares tied places and leaves unknowns unranked", () => {
  const postLikes = new Map([
    ["https://lnkd.in/p/eu8-2dYF", 15],
    ["https://x.com/AlexanderO73639/status/2108345937550544979", 2],
    ["https://lnkd.in/p/d4CRUJ-H", 86],
    ["https://lnkd.in/p/dVytzWnu", 4],
  ]);
  const games = [
    { name: "No post", links: [] },
    {
      name: "Multiple posts",
      links: [
        { url: "https://lnkd.in/p/eu8-2dYF" },
        { url: "https://x.com/AlexanderO73639/status/2108345937550544979" },
      ],
    },
    {
      name: "Unverified",
      links: [{ url: "https://example.com/unverified-post" }],
    },
    { name: "Leader", links: [{ url: "https://lnkd.in/p/d4CRUJ-H" }] },
    { name: "Tie", links: [{ url: "https://lnkd.in/p/eu8-2dYF" }] },
    { name: "Lower", links: [{ url: "https://lnkd.in/p/dVytzWnu" }] },
  ];

  expect(
    rankGames(games, postLikes).map(({ name, likes, rank }) => ({
      name,
      likes,
      rank,
    })),
  ).toEqual([
    { name: "Leader", likes: 86, rank: 1 },
    { name: "Multiple posts", likes: 15, rank: 2 },
    { name: "Tie", likes: 15, rank: 2 },
    { name: "Lower", likes: 4, rank: 4 },
    { name: "No post", likes: null, rank: null },
    { name: "Unverified", likes: null, rank: null },
  ]);
  expect(games[0]?.name).toBe("No post");
});
