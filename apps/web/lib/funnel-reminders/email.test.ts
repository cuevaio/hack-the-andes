import { afterEach, describe, expect, test } from "bun:test";
import { challengeBySlug } from "@chofex/challenges-contract";

import { buildFunnelReminderEmail, sendFunnelReminderEmail } from "./email";

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

describe("funnel reminder emails", () => {
  test.each(["registration", "challenge_start", "challenge_finish"] as const)(
    "sends the %s reminder with the shared sender, reply-to, and CC",
    async (stage) => {
      process.env.RESEND_API_KEY = "test-key";
      let headers = new Headers();
      let body: Record<string, unknown> = {};
      const mockFetch = async (
        _input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        headers = new Headers(init?.headers);
        body = JSON.parse(String(init?.body));
        return new Response(null, { status: 200 });
      };
      globalThis.fetch = Object.assign(mockFetch, {
        preconnect: originalFetch.preconnect,
      });

      await sendFunnelReminderEmail({
        stage,
        clerkUserId: "user-123",
        deliveryScope: "application-456",
        challenge: challengeBySlug("broken-agent"),
        email: "ada@example.com",
        firstName: "Ada",
      });

      expect(body.from).toBe("hi@cueva.io");
      expect(body.reply_to).toBe("hi@cueva.io");
      expect(body.cc).toEqual(["shiara.arauzo@gmail.com"]);
      expect(body.to).toEqual(["ada@example.com"]);
      expect(headers.get("idempotency-key")).toBe(
        `funnel-reminder/${stage}/user-123/application-456`,
      );
    },
  );

  test.each([
    ["registration", "andes register", "Enviar mi postulación"],
    ["challenge_start", "andes challenge init", "Empezar el challenge"],
    [
      "challenge_finish",
      "andes challenge show --challenge broken-agent",
      "Terminar el challenge",
    ],
  ] as const)("builds the %s call to action", (stage, command, action) => {
    const email = buildFunnelReminderEmail({
      stage,
      email: "ada@example.com",
      firstName: "Ada",
      challenge: challengeBySlug("broken-agent"),
    });

    expect(email.text).toContain(command);
    expect(email.html).toContain(action);
    if (stage !== "registration") {
      expect(email.text).toContain("/challenges/broken-agent");
      expect(email.html).toContain(command);
      expect(email.text).not.toContain("shipping.js");
      expect(email.text).toContain("evaluación oficial");
    }
    if (stage === "challenge_finish") {
      expect(email.text).toContain(
        "--source ./scheduler.js --review ./review.json",
      );
      expect(email.html).toContain("enlace de aprobación");
      expect(email.text).toContain("andes status");
    }
    expect(email.text).toContain("grupo exclusivo de hackers");
    expect(email.text).toContain("más de S/ 8,000 en premios");
    expect(email.text).toContain("vuelos a Lima");
    expect(email.text).toContain("comida, bebidas, energy drinks, merch");
  });

  test("escapes the recipient name in HTML", () => {
    const email = buildFunnelReminderEmail({
      stage: "registration",
      email: "ada@example.com",
      firstName: '<Ada & "friends">',
    });

    expect(email.html).toContain("&lt;Ada &amp; &quot;friends&quot;&gt;");
    expect(email.html).not.toContain('<Ada & "friends">');
  });
});
