import { expect, test } from "bun:test";
import { certificateEmail } from "./email";

const certificate = {
  id: `HTA-2026-${"A".repeat(32)}`,
  recipientName: "Ana <Pérez>",
  issuedAt: "2026-10-20T17:00:00Z",
  status: "valid" as const,
};

test("congratulations email has the participant's public link and CLI instructions", () => {
  const email = certificateEmail(certificate);
  expect(email.subject).toBe(
    "¡Felicitaciones por participar en Hack the Andes!",
  );
  expect(email.text).toContain("andes update\nandes certificate");
  expect(email.text).toContain("andes login");
  expect(email.text).toContain(
    `https://hacktheandes.com/certificate/${certificate.id}`,
  );
  expect(email.text).toContain(
    "PDF, firmado por Shiara Arauzo y Anthony Cueva",
  );
  expect(email.html).toContain("Ana &lt;Pérez&gt;");
  expect(email.html).not.toContain("Ana <Pérez>");
});
