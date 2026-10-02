import { expect, test } from "bun:test";
import type { SlowServiceApprovalSnapshot } from "@chofex/challenges-contract";
import { renderToStaticMarkup } from "react-dom/server";
import { SlowServiceApprovalView } from "./slow-service-approval-view";

const snapshot: SlowServiceApprovalSnapshot = {
  challengeSlug: "make-it-fast",
  challengeVersion: "slow-service-v3",
  source: "function createLedger() { /* <script>unsafe()</script> */ }",
  review: {
    sourceDigest: "a".repeat(64),
    focus: "historical_percentiles",
    failureScenario:
      "Two different debit magnitudes must select the exact nearest rank.",
    evidence:
      "The test reported P50=100 and P100=300 for debits of 100 and 300.",
    decision: "ship",
    confidence: 80,
    remainingRisk:
      "Maximum retained history must be measured before the official evaluation.",
  },
};
test("shows escaped exact source, evidence, responsibility and browser approval", () => {
  const html = renderToStaticMarkup(
    <SlowServiceApprovalView
      id="approval"
      snapshot={snapshot}
      expiresAt="2026-10-03T00:00:00Z"
      now={0}
    />,
  );
  expect(html).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
  expect(html).not.toContain("<script>unsafe()");
  expect(html).not.toContain("P50=100 y");
  expect(html).toContain("P50=100 and P100=300");
  expect(html).toContain("no demuestra comprensión ni autoría independiente");
  expect(html).toContain("Aprobar en este equipo");
});
test("expired, blocked and consumed reviews cannot present approval controls", () => {
  for (const props of [
    { consumedAt: "2026-10-02T20:00:00Z", approvedAt: "2026-10-02T19:00:00Z" },
    { now: Date.parse("2026-10-03T01:00:00Z") },
    {
      snapshot: {
        ...snapshot,
        review: { ...snapshot.review, decision: "block" as const },
      },
    },
  ]) {
    const html = renderToStaticMarkup(
      <SlowServiceApprovalView
        id="approval"
        snapshot={snapshot}
        expiresAt="2026-10-03T00:00:00Z"
        now={0}
        {...props}
      />,
    );
    expect(html).not.toContain("Aprobar en este equipo");
  }
});
