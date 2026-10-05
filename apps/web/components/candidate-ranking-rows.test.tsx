import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { Candidate } from "../lib/admin/types";
import { CandidateRankingRows } from "./candidate-ranking-rows";

const candidate: Candidate = {
  id: "current-application",
  participantId: "participant",
  name: "Ada",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.invalid",
  status: "submitted",
  funnelStatus: "challenge_completed",
  mediaConsent: false,
  signedUpAt: "2026-08-01",
  createdAt: "2026-09-01",
  attemptNumber: 2,
  applicationHistory: [],
  decisionHistory: [],
  nationalIdProvided: false,
  challenges: [],
  challengeHistory: [],
  rankingResult: {
    slug: "black-box",
    rank: 21,
    evaluatedAt: "2026-09-01",
    score: {
      accuracy: 0.9,
      exactCount: 9,
      sampleSize: 10,
      meanError: 0,
      queriesUsed: 3,
      runtimeMs: 50,
    },
  },
};

test("ranking rows show exact global rank, score and explicit review controls", () => {
  const html = renderToStaticMarkup(
    <CandidateRankingRows candidates={[candidate]} onReview={() => {}} />,
  );
  expect(html).toContain("#21");
  expect(html).toContain("90.00%");
  expect(html).toContain("Ver detalles de Ada");
  expect(html).toContain("Aprobar a Ada");
  expect(html).toContain("Rechazar a Ada");
});

test("drafts and decided applications remain visible without decision buttons", () => {
  for (const status of ["draft", "accepted", "rejected"] as const) {
    const html = renderToStaticMarkup(
      <CandidateRankingRows
        candidates={[{ ...candidate, status }]}
        onReview={() => {}}
      />,
    );
    expect(html).toContain("#21");
    expect(html).toContain("Ver detalles de Ada");
    expect(html).not.toContain("Aprobar a Ada");
    expect(html).not.toContain("Rechazar a Ada");
  }
});
