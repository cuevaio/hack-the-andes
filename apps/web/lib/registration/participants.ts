import {
  and,
  eq,
  isNull,
  or,
  type PgDatabase,
  type PgQueryResultHKT,
  sql,
} from "@chofex/db/orm";
import { participants } from "@chofex/db/schema";
import { HttpError } from "./http";

export type ParticipantDatabase = Pick<
  PgDatabase<PgQueryResultHKT>,
  "select" | "insert" | "update"
>;

export const selectParticipantCountry = async (
  participantId: string,
  countryCode: string,
): Promise<void> => {
  const { db } = await import("@chofex/db");
  const [selected] = await db
    .update(participants)
    .set({ countryCode, updatedAt: new Date() })
    .where(
      and(
        eq(participants.id, participantId),
        or(
          isNull(participants.countryCode),
          eq(participants.countryCode, countryCode),
        ),
      ),
    )
    .returning({ id: participants.id });
  if (!selected) {
    throw new HttpError(
      409,
      "COUNTRY_ALREADY_SET",
      "Tu país ya está guardado. Solo el equipo organizador puede corregirlo tras revisar tu LinkedIn u otras redes sociales.",
    );
  }
};

export const participantIdFor = async (
  clerkUserId: string,
  defaultName?: string,
  database?: ParticipantDatabase,
): Promise<string> => {
  const db = database ?? (await import("@chofex/db")).db;
  const defaultValue = defaultName?.trim();
  let name: string | undefined;
  if (defaultValue && defaultValue.length <= 200) name = defaultValue;
  const [participant] = await db
    .insert(participants)
    .values({ clerkUserId, name })
    .onConflictDoUpdate({
      target: participants.clerkUserId,
      set: {
        name: sql`coalesce(nullif(${participants.name}, ''), excluded.name)`,
      },
    })
    .returning({ id: participants.id });
  if (!participant) throw new Error("Participant creation returned no row");
  return participant.id;
};
