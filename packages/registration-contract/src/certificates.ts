import { Schema } from "effect";

export const CertificateIdSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^HTA-2026-[A-F0-9]{32}$/)),
);
export const ParticipationCertificateSchema = Schema.Struct({
  id: CertificateIdSchema,
  recipientName: Schema.String,
  issuedAt: Schema.String,
  status: Schema.Literals(["valid", "revoked"]),
});
export type ParticipationCertificate =
  typeof ParticipationCertificateSchema.Type;
export const CertificateReceiptSchema = Schema.Struct({
  certificate: ParticipationCertificateSchema,
  url: Schema.String,
});
export type CertificateReceipt = typeof CertificateReceiptSchema.Type;
