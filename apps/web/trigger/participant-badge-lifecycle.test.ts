import { describe, expect, test } from "bun:test";

const source = async (file: string): Promise<string> =>
  await Bun.file(new URL(file, import.meta.url)).text();

describe("participant badge generation lifecycle", () => {
  test("clears old assets before a new generation can fail", async () => {
    const enqueue = await source("../lib/badges/enqueue.ts");

    expect(enqueue).toContain("badgeUrl: null");
    expect(enqueue).toContain("portraitUrl: null");
  });

  test("lets only the current generation publish assets or send email", async () => {
    const parent = await source("./generate-participant-badge.ts");
    const badge = await source("./generate-badge.ts");
    const portrait = await source("./generate-portrait.ts");

    const enqueue = await source("../lib/badges/enqueue.ts");
    expect(enqueue).toContain("generationId = crypto.randomUUID()");
    expect(enqueue).toContain(
      "{ applicationId, generationId, notification: options.notification }",
    );
    expect(enqueue).toMatch(
      /participant-badge\/\$\{applicationId\}\/\$\{generationId\}/,
    );
    expect(parent).toContain("badge?.generationId !== payload.generationId");
    expect(parent).toContain(
      "eq(participantBadges.generationId, payload.generationId)",
    );
    expect(badge).toContain(
      "eq(participantBadges.generationId, payload.generationId)",
    );
    expect(portrait).toContain(
      "eq(participantBadges.generationId, payload.generationId)",
    );
  });

  test("exposes the default badge as soon as the application is accepted", async () => {
    const service = await source("../lib/badges/service.ts");

    expect(service).toContain('eq(applications.status, "accepted")');
    expect(service).not.toContain("isNotNull(acceptanceDetails.completedAt)");
  });

  test("generates the default badge before attendance confirmation", async () => {
    const parent = await source("./generate-participant-badge.ts");

    expect(parent).not.toContain(
      "Participant has not completed attendance confirmation",
    );
  });

  test("invalidates old generations before changing the badge profile", async () => {
    const profile = await source("../lib/badges/profile.ts");
    const registration = await source("../lib/registration/service.ts");

    expect(profile).toContain("generationId: null");
    expect(registration).toContain("generationId: null");
  });

  test("starts default badge generation when an admin accepts a candidate", async () => {
    const candidates = await source("../lib/admin/candidates.ts");
    const enqueue = await source("../lib/badges/enqueue.ts");
    const parent = await source("./generate-participant-badge.ts");

    expect(candidates).toContain("storeAcceptanceBadgeProfile");
    expect(candidates).toContain("enqueueBadgeGeneration");
    expect(candidates).toContain("const sendRejectionEmail");
    expect(candidates).not.toContain("const sendDecisionEmail");
    expect(candidates).toContain(
      'notification: { kind: "acceptance", message }',
    );
    expect(enqueue).toContain("notification: options.notification");
    expect(parent).toContain("notification: payload.notification");
  });

  test("marks a generation failed when Trigger dispatch fails", async () => {
    const enqueue = await source("../lib/badges/enqueue.ts");

    expect(enqueue).toContain("Could not enqueue badge generation");
    expect(enqueue).toContain('status: "failed"');
  });

  test("reports notification failure instead of exposing stale success", async () => {
    const parent = await source("./generate-participant-badge.ts");

    expect(parent).toContain('status: "failed"');
    expect(parent).toContain("Badge created but notification failed");
  });
});
