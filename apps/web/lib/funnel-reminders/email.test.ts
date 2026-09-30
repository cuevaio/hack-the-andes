import { describe, expect, test } from "bun:test";

import { buildFunnelReminderEmail } from "./email";

describe("funnel reminder emails", () => {
  test.each([
    ["registration", "andes register", "Enviar mi postulación"],
    ["challenge_start", "andes challenge init", "Empezar el challenge"],
    [
      "challenge_finish",
      "andes challenge evaluate --source ./shipping.js",
      "Terminar el challenge",
    ],
  ] as const)("builds the %s call to action", (stage, command, action) => {
    const email = buildFunnelReminderEmail({
      stage,
      email: "ada@example.com",
      firstName: "Ada",
    });

    expect(email.text).toContain(command);
    expect(email.html).toContain(action);
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
