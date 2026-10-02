import { expect, test } from "bun:test";
import {
  type ChallengeRankingEntry,
  challengeBySlug,
} from "@chofex/challenges-contract";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogItemFor } from "../../lib/challenges/catalog";
import { publicRankingEntries } from "../../lib/challenges/ranking-policy";
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
  expect(html).toContain("95% o más");
  expect(html).toContain(
    "Todavía no hay participantes con un puntaje de 95% o más",
  );
  expect(html).not.toContain("Aparecen todos los puntajes válidos");
  expect(html).not.toContain("andes challenge init --challenge broken-agent");
});

test("Scheduler page renders all qualifying participants, including ranks after 17", () => {
  const challenge = challengeBySlug("broken-agent");
  if (!challenge) throw new Error("missing broken-agent");
  const now = new Date("2026-10-02T05:00:00.000Z");
  const ranked = Array.from(
    { length: 24 },
    (_, index): ChallengeRankingEntry => {
      let accuracy = 0.97;
      if (index === 21) accuracy = 0.95;
      if (index > 21) accuracy = 0.9499;
      return {
        rank: index + 1,
        displayName: `Participant ${index + 1}`,
        shareCode: `CODE${index + 1}`,
        accuracy,
        exactCount: Math.round(accuracy * 100),
        sampleSize: 100,
        meanError: 0,
        queriesUsed: 0,
        runtimeMs: 0,
        evaluatedAt: now.toISOString(),
      };
    },
  );
  const entries = publicRankingEntries({ slug: challenge.slug, ranked });
  const html = renderToStaticMarkup(
    <ChallengeRankingView
      now={now.toISOString()}
      ranking={{
        challenge: catalogItemFor(challenge, now, false),
        entries,
        competitorCount: entries.length,
      }}
    />,
  );

  expect(html.match(/<tr\b/g)).toHaveLength(23);
  expect(html).toContain("Participant 18");
  expect(html).toContain("Participant 22");
  expect(html).toContain("#22");
  expect(html).toContain("95%");
  expect(html).not.toContain("Participant 23");
  expect(html).not.toContain("Participant 24");
  expect(html).toContain("sin límite de participantes");
});
