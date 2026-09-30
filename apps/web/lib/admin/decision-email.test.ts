import { describe, expect, test } from "bun:test";

import { buildDecisionEmail } from "./decision-email";

describe("buildDecisionEmail", () => {
  test("renders approval copy with concrete attendance next steps", () => {
    // Spanish, like the site and like the reminder emails already were.
    // These two were the last ones writing to people in English.
    const email = buildDecisionEmail({
      decision: "accepted",
      firstName: "Ada",
      badgeUrl: "https://blob.example/ada-badge.png",
      badgePageUrl: "https://hacktheandes.com/badge",
      placement: "BLACK BOX · #07",
    });

    expect(email.subject).toBe("Estás dentro — bienvenida a Hack the Andes");
    expect(email.text).toContain("Hola Ada,");
    expect(email.text).toContain("andes confirm");
    expect(email.text).toContain("carnet predeterminado");
    expect(email.text).toContain("DNI o pasaporte");
    expect(email.text).toContain("WhatsApp");
    expect(email.html).toContain("POSTULACIÓN APROBADA");
    expect(email.html).toContain("Confirmar mi asistencia");
    expect(email.html).toContain("https://blob.example/ada-badge.png");
    expect(email.html).toContain("BLACK BOX · #07");
  });

  test("renders respectful denial copy and reapplication next steps", () => {
    const email = buildDecisionEmail({
      decision: "rejected",
      firstName: "Grace",
    });

    expect(email.subject).toBe("Una actualización sobre tu postulación");
    expect(email.text).toContain("no podemos ofrecerte un lugar");
    expect(email.text).toContain("andes register");
    expect(email.html).toContain("Gracias por postular.");
  });

  test("includes the review note and escapes HTML input", () => {
    const email = buildDecisionEmail({
      decision: "accepted",
      firstName: '<Ada & "friends">',
      message: "Bring <ideas> & curiosity.",
      badgeUrl: "https://blob.example/badge.png?a=1&b=2",
      badgePageUrl: "https://hacktheandes.com/badge?a=1&b=2",
      placement: "PARTICIPANT",
    });

    expect(email.text).toContain("Una nota del equipo de revisión:");
    expect(email.text).toContain("Bring <ideas> & curiosity.");
    expect(email.html).toContain("&lt;Ada &amp; &quot;friends&quot;&gt;");
    expect(email.html).toContain("Bring &lt;ideas&gt; &amp; curiosity.");
    expect(email.html).not.toContain("Bring <ideas>");
  });

  test("gives somebody without a terminal a way through", () => {
    /*
      Confirming attendance is the only thing this email exists to get
      done. It was a command and nothing else, which asks a person
      reading on a phone to remember it until they reach a laptop.
    */
    const email = buildDecisionEmail({
      decision: "accepted",
      firstName: "Ada",
      badgeUrl: "https://blob.example/ada-badge.png",
      badgePageUrl: "https://hacktheandes.com/badge",
      placement: "PARTICIPANT",
    });

    expect(email.html).toContain("https://hacktheandes.com/welcome");
  });
});
