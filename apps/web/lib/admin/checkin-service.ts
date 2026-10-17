import { sql } from "@chofex/db/orm";
import { Schema } from "effect";
import { eventQuery } from "@/lib/event/database";
import { HttpError } from "@/lib/registration/http";
import { decryptSensitiveValue } from "@/lib/registration/sensitive";
import {
  CheckinConfirmationSchema,
  type CheckinParticipant,
  type CheckinRoster,
  CheckinRosterSchema,
} from "./checkin-contract";
import { matchesCheckinSearch } from "./checkin-search";

const storedParticipantSchema = Schema.Struct({
  participantId: Schema.String,
  applicationId: Schema.String,
  name: Schema.String,
  legalName: Schema.String,
  email: Schema.String,
  pictureUrl: Schema.NullOr(Schema.String),
  encryptedDocument: Schema.NullOr(Schema.String),
  eligibility: Schema.Literals(["ready", "confirmation-required"]),
  checkedInAt: Schema.NullOr(Schema.String),
});

export async function getCheckinRoster(search = ""): Promise<CheckinRoster> {
  const rows = Schema.decodeUnknownSync(Schema.Array(storedParticipantSchema))(
    await eventQuery(sql`select coalesce(jsonb_agg(jsonb_build_object(
      'participantId',p.id,'applicationId',a.id,'name',coalesce(nullif(p.name,''),nullif(p.legal_name,''),'Participante'),
      'legalName',coalesce(p.legal_name,''),'email',coalesce(a.email,''),
      'pictureUrl',coalesce(nullif(b.picture_url,''),a.picture_url),'encryptedDocument',d.national_id_number,
      'eligibility',case when c.application_id is null then 'confirmation-required' else 'ready' end,
      'checkedInAt',d.checked_in_at
    )),'[]'::jsonb) as result from participants p join applications a on a.participant_id=p.id and a.status='accepted'
      left join acceptance_details d on d.application_id=a.id
      left join participant_badges b on b.application_id=a.id
      left join hackathon_confirmed_participants c on c.application_id=a.id`),
  );
  const key = process.env.PARTICIPANT_DATA_ENCRYPTION_KEY;
  if (
    rows.some((row) => row.encryptedDocument) &&
    (!key || Buffer.from(key, "base64").length !== 32)
  ) {
    throw new HttpError(
      503,
      "CHECKIN_CONFIGURATION_REQUIRED",
      "No se pueden consultar los documentos. Revisa la configuración de cifrado.",
    );
  }
  const participants: CheckinParticipant[] = [];
  let checkedIn = 0;
  let confirmationRequired = 0;
  for (const row of rows) {
    if (row.checkedInAt !== null) checkedIn++;
    if (row.eligibility === "confirmation-required") confirmationRequired++;
    const { encryptedDocument, ...identity } = row;
    let document: string | null = null;
    let documentView: CheckinParticipant["document"] = {
      status: "not-provided",
    };
    if (encryptedDocument && key) {
      try {
        document = decryptSensitiveValue(encryptedDocument, key);
        documentView = { status: "available", lastFour: document.slice(-4) };
      } catch {
        documentView = { status: "unavailable" };
      }
    }
    if (matchesCheckinSearch(identity, document, search))
      participants.push({ ...identity, document: documentView });
  }
  return Schema.decodeUnknownSync(CheckinRosterSchema)({
    participants,
    counts: {
      total: rows.length,
      checkedIn,
      pending: rows.length - checkedIn,
      confirmationRequired,
    },
  });
}

export async function confirmParticipantArrival(
  adminId: string,
  applicationId: string,
) {
  return Schema.decodeUnknownSync(CheckinConfirmationSchema)(
    await eventQuery(
      sql`select hackathon_confirm_arrival(${applicationId}::uuid,${adminId}) as result`,
    ),
  );
}
