import { sql } from "@chofex/db/orm";
import {
  CertificateIdSchema,
  ParticipationCertificateSchema,
} from "@chofex/registration-contract";
import { Schema } from "effect";
import { eventQuery } from "@/lib/event/database";

export async function issueCertificate(clerkUserId: string) {
  return Schema.decodeUnknownSync(ParticipationCertificateSchema)(
    await eventQuery(
      sql`select hackathon_issue_certificate(${clerkUserId}) as result`,
    ),
  );
}

export async function findCertificate(id: string) {
  if (!Schema.is(CertificateIdSchema)(id)) return null;
  return Schema.decodeUnknownSync(
    Schema.NullOr(ParticipationCertificateSchema),
  )(
    await eventQuery(sql`select hackathon_certificate_result(${id}) as result`),
  );
}
