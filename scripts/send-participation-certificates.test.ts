import { expect, test } from "bun:test";
import { certificateMailPayload } from "./send-participation-certificates";

const certificate = {
  id: `HTA-2026-${"A".repeat(32)}`,
  recipientName: "Ana <Pérez>",
  issuedAt: "2026-10-20T17:00:00Z",
  status: "valid" as const,
};

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
