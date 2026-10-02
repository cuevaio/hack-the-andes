import { expect, test } from "bun:test";
import { challengeBySlug } from "@chofex/challenges-contract";
import {
  slowServiceChallengeVersion,
  slowServicePublicPerformance,
} from "@chofex/challenges-contract/slow-service";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogItemFor } from "../../lib/challenges/catalog";
import { ChallengeRankingView } from "./ranking-view";

test("the third challenge renders its Spanish companion guide without exposing an oracle", () => {
  const challenge = challengeBySlug("make-it-fast");
  if (!challenge) throw new Error("missing challenge");
  const now = new Date("2026-10-02T12:00:00Z");
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
  expect(html).toContain(slowServiceChallengeVersion);
  expect(challenge.playable).toBe(true);
  expect(html).toContain("createLedger");
  expect(html.replace(/<[^>]+>/g, "")).toContain(
    "andes challenge evaluate --challenge make-it-fast",
  );
  expect(html).toContain("N y 4N");
  expect(html).toContain("5 evaluaciones oficiales");
  expect(html).not.toContain("andes challenge query");
  expect(html.replace(/<[^>]+>/g, "")).toContain("--review ./review.json");
  expect(html).not.toContain("Checkpoints QuickJS</th>");
  const text = html.replace(/<[^>]+>/g, "");
  expect(text).toContain("bun test ./.kit/ledger.test.ts");
  expect(text).toContain("bun run benchmark ledger.js");
  expect(text).toContain("bun run benchmark ledger.js 6000");
  expect(text).toContain("bun run benchmark ledger.js 6000 --max-history");
  expect(text).toContain(
    "bun run benchmark ledger.js 6000 --max-history --negative-heavy",
  );
  expect(text).toContain("2,000 y 8,000 journals");
  expect(text).toContain("63,000 ediciones de débitos");
  expect(text).toContain(
    "no los tamaños oficiales de eficiencia de 6,000 y 24,000",
  );
  expect(text).toContain(
    `${slowServicePublicPerformance.smallJournalCount.toLocaleString("en-US")} y ${slowServicePublicPerformance.largeJournalCount.toLocaleString("en-US")}`,
  );
  expect(text).toContain("640 MiB");
  expect(text).toContain("peakRssBytes");
  expect(text).toContain("minimumBalance");
  expect(text).toContain("expectedRevision");
  expect(text).toContain("72,000");
  expect(text).toContain("10, 6, 3 o 0");
  expect(text).toContain("1,024 operaciones");
  expect(text).toContain("De 2 a 1,024");
  expect(text).toContain("no demuestra comprensión ni autoría independiente");
  expect(text).toContain("aprueba con tu passkey");
  expect(text).toContain("block detiene el envío");
  expect(text).toContain("No agregan grupos de correctitud ni puntos");
  expect(text).toContain("1,024 cuentas con IDs de 64");
  expect(text).toContain("conservas los puntos de correctitud");
  expect(text).toContain("Límites de v3");
  expect(text).not.toContain("provisionales");
  expect(text).toContain("percentile: 50");
  expect(text).toContain("debitAmountAtPercentile: null");
  expect(text).toContain("ceil(debits * percentile / 100)");
  expect(text).toContain("percentil 50 de [100, 300] es 100, no 200");
  expect(text).toContain("el percentil 100 es 300");
  expect(text).toContain("multiplicidad");
  expect(text).toContain("Los créditos no entran en la distribución");
  expect(text).toContain("conservas esos 60 puntos");
  expect(text).toContain("rechazo de inicialización no consume un intento");
  expect(text).not.toContain("distinctCustomers");
  expect(text).not.toContain("apply(");
  const rows = [...html.matchAll(/<tr>(.*?)<\/tr>/g)].map((match) =>
    match[1]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  expect(rows).toContain("10 1.8 3");
  expect(rows).toContain("6 3.5 6");
  expect(rows).toContain("3 6 12");
  expect(text).not.toContain("todavía se calibran");
  expect(text).not.toContain("slow-service-v1");
  expect(text).not.toContain("slow-service-v2");
  expect(text).not.toContain("party");
  expect(text).not.toContain("180,000");
  expect(text).not.toContain("48,000");
  expect(text).not.toContain("384 MiB");
  expect(
    text.match(/andes challenge evaluate --challenge make-it-fast --source/g),
  ).toHaveLength(1);
});
