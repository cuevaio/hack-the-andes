import { afterEach, describe, expect, test } from "bun:test";

import { buildBadgeReadyEmail, sendBadgeReadyEmail } from "./email";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.RESEND_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey) {
    process.env.RESEND_API_KEY = originalApiKey;
  } else {
    delete process.env.RESEND_API_KEY;
  }
});

describe("badge-ready email", () => {
  test("explains the default badge, confirmation, sharing, and ranked achievement", () => {
    const email = buildBadgeReadyEmail({
      firstName: "Ada",
      badgeUrl: "https://example.com/badge.png",
      placement: "BLACK BOX · #01",
      badgePageUrl: "https://hacktheandes.com/badge",
      requiresConfirmation: true,
      notification: { kind: "acceptance" },
    });

    expect(email.subject).toBe("Estás dentro — bienvenida a Hack the Andes");
    expect(email.text).toContain("BLACK BOX · #01");
    expect(email.text).toContain("carnet predeterminado");
    expect(email.text).toContain("andes confirm");
    expect(email.text).toContain("nombre");
    expect(email.text).toContain("foto");
    expect(email.text).toContain("presentación");
    expect(email.text).toContain("DNI o pasaporte");
    expect(email.text).toContain("WhatsApp");
    expect(email.text).toContain("LinkedIn");
    expect(email.text).toContain("Instagram");
    expect(email.html).toContain("BLACK BOX · #01");
    expect(email.html).toContain("https://example.com/badge.png");
  });

  test("does not claim an unranked participant has a ranking", () => {
    const email = buildBadgeReadyEmail({
      firstName: "Grace",
      badgeUrl: "https://example.com/badge.png",
      placement: "PARTICIPANT",
      badgePageUrl: "https://hacktheandes.com/badge",
      requiresConfirmation: true,
      notification: { kind: "acceptance" },
    });

    expect(email.text).not.toContain("posición en el challenge");
  });

  test("does not ask a participant to confirm again after regeneration", () => {
    const email = buildBadgeReadyEmail({
      firstName: "Grace",
      badgeUrl: "https://example.com/badge.png",
      placement: "BLACK BOX · #02",
      badgePageUrl: "https://hacktheandes.com/badge",
      requiresConfirmation: false,
    });

    expect(email.text).toContain("andes badge regenerate");
    expect(email.text).not.toContain("andes confirm");
    expect(email.text).not.toContain("carnet predeterminado");
    expect(email.text).not.toContain("¡Felicitaciones!");
  });

  test("sends one idempotent, HTML-safe notification", async () => {
    process.env.RESEND_API_KEY = "test-key";
    let headers = new Headers();
    let body: Record<string, unknown> = {};
    const mockFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      headers = new Headers(init?.headers);
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(null, { status: 200 });
    };
    globalThis.fetch = Object.assign(mockFetch, {
      preconnect: originalFetch.preconnect,
    });

    await sendBadgeReadyEmail({
      applicationId: "application-123",
      email: "ada@example.com",
      firstName: "Ada <Admin>",
      badgeUrl: "https://example.com/badge.png?a=1&b=2",
      placement: "BLACK BOX · #07",
      badgePageUrl: "https://hacktheandes.com/badge",
      requiresConfirmation: true,
      generationId: "run-456",
      notification: {
        kind: "acceptance",
        message: "Trae tus mejores ideas.",
      },
    });

    expect(headers.get("idempotency-key")).toBe(
      "participant-badge/application-123/run-456",
    );
    expect(body.from).toBe("hi@cueva.io");
    expect(body.reply_to).toBe("hi@cueva.io");
    expect(body.cc).toEqual(["shiara.arauzo@gmail.com"]);
    expect(body.to).toEqual(["ada@example.com"]);
    expect(body.html).toContain("Ada &lt;Admin&gt;");
    expect(body.html).toContain("a=1&amp;b=2");
    // The face, and a way to the card — not a flattened picture of one.
    expect(body.html).toContain("https://hacktheandes.com/badge");
    expect(body.html).toContain("andes confirm");
    expect(body.html).toContain("Trae tus mejores ideas.");
    expect(body.subject).toBe("Estás dentro — bienvenida a Hack the Andes");
  });
});
