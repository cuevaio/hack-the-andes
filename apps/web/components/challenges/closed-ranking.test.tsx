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
  expect(html).toContain("Top 20");
  expect(html).toContain("Nadie ha enviado una evaluación oficial todavía");
  expect(html).not.toContain("Aparecen todos los puntajes válidos");
  expect(html).not.toContain("andes challenge init --challenge broken-agent");
});

test("Scheduler page renders only the top 20 participants", () => {
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

  expect(html.match(/<tr\b/g)).toHaveLength(21);
  expect(html).toContain("Participant 18");
  expect(html).toContain("Participant 20");
  expect(html).toContain("#20");
  expect(html).not.toContain("Participant 21");
  expect(html).not.toContain("Participant 23");
  expect(html).not.toContain("Participant 24");
  expect(html).toContain("Top 20");
});

test("closed Slow Service publishes the top 20 with achievement time and CPU", () => {
  const challenge = challengeBySlug("make-it-fast");
  if (!challenge) throw new Error("missing make-it-fast");
  const now = new Date("2026-10-05T18:51:16.000Z");
  const ranked = Array.from(
    { length: 34 },
    (_, index): ChallengeRankingEntry => ({
      rank: index + 1,
      displayName: `Participant ${index + 1}`,
      shareCode: `CODE${index + 1}`,
      accuracy: 1,
      exactCount: 100,
      sampleSize: 100,
      meanError: 0,
      queriesUsed: 0,
      runtimeMs: 70_322,
      evaluatedAt: "2026-10-03T12:00:00.000Z",
    }),
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
  expect(html.match(/<tr\b/g)).toHaveLength(21);
  expect(html).toContain("Participant 20");
  expect(html).not.toContain("Participant 21");
  expect(html).not.toContain("Participant 34");
  expect(html).toContain("Mejor resultado (Lima)");
  expect(html).toMatch(/datetime="2026-10-03T12:00:00.000Z"/i);
  expect(html).toContain("07:00:00");
  expect(html).toContain("CPU registrada");
  expect(html).toContain("70.32 s");
  expect(html).toContain("tiene prioridad quien lo alcanzó primero");
  expect(html).toContain("Top 20");
  expect(html).toContain("Cerrado");
  expect(html).not.toContain("andes challenge init --challenge make-it-fast");
});
