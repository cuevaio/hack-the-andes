import { db } from "@chofex/db";
import { and, eq, isNull, or } from "@chofex/db/orm";
import { participants } from "@chofex/db/schema";
import { HttpError } from "./http";

export const selectParticipantCountry = async (
  participantId: string,
  countryCode: string,
): Promise<void> => {
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
): Promise<string> => {
  const [existing] = await db
    .select({ id: participants.id, name: participants.name })
    .from(participants)
    .where(eq(participants.clerkUserId, clerkUserId))
    .limit(1);
  const name = defaultName?.trim() || undefined;
  if (existing) {
    if (!existing.name && name) {
      await db
        .update(participants)
        .set({ name, updatedAt: new Date() })
        .where(eq(participants.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(participants)
    .values({ clerkUserId, name })
    .onConflictDoNothing()
    .returning({ id: participants.id });
  if (created) return created.id;

  const [concurrent] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.clerkUserId, clerkUserId))
    .limit(1);
  if (!concurrent) throw new Error("Participant creation returned no row");
  return concurrent.id;
};
