import { expect, test } from "bun:test";
import { certificateMailPayload } from "../../../../scripts/send-participation-certificates";
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

test("each email attaches exactly its recipient's PDF with explicit sender and Reply-To", () => {
  const pdf = Buffer.from("%PDF-1.7 personal certificate bytes");
  const payload = certificateMailPayload({
    certificate,
    email: "ana@example.com",
    pdf,
  });
  expect(payload.to).toEqual(["ana@example.com"]);
  expect(payload.from).toBe("Hack the Andes <hi@cueva.io>");
  expect(payload.reply_to).toBe("hi@cueva.io");
  expect("cc" in payload).toBe(false);
  expect("bcc" in payload).toBe(false);
  expect(payload.attachments).toEqual([
    {
      filename: `Hack-the-Andes-${certificate.id}.pdf`,
      content: pdf.toString("base64"),
    },
  ]);
  expect(Buffer.from(payload.attachments[0]?.content ?? "", "base64")).toEqual(
    pdf,
  );
});
