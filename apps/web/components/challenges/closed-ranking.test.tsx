import { expect, test } from "bun:test";
import { challengeBySlug } from "@chofex/challenges-contract";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogItemFor } from "../../lib/challenges/catalog";
import { ChallengeRankingView } from "./ranking-view";

test("closed Scheduler renders the waiting message and retains its ranking", () => {
  const challenge = challengeBySlug("broken-agent");
  if (!challenge) throw new Error("missing broken-agent");
  const now = new Date("2026-10-02T05:00:00.000Z");
  const html = renderToStaticMarkup(
    <ChallengeRankingView
      now={now.toISOString()}
      ranking={{
        challenge: catalogItemFor(challenge, now, false),
        entries: [],
        competitorCount: 0,
      }}
    />,
  );
  expect(html).toContain("Espera el próximo challenge");
  expect(html).toContain("Ya no se reciben soluciones ni evaluaciones");
  expect(html).toContain("Cerrado");
  expect(html).toContain("Ranking");
  expect(html).not.toContain("andes challenge init --challenge broken-agent");
});
