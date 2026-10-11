import { db } from "@chofex/db";
import { and, eq, isNotNull } from "@chofex/db/orm";
import {
  acceptanceDetails,
  applications,
  participantBadges,
  participants,
} from "@chofex/db/schema";
import {
  BadgeRegenerationInput,
  type BadgeRegenerationInput as Input,
} from "@chofex/registration-contract";
import { Schema } from "effect";

import { HttpError } from "@/lib/registration/http";
import { confirmedPictureUrl } from "@/lib/registration/pictures";

interface BadgeIdentity {
  readonly clerkUserId: string;
  readonly clerkPictureUrl?: string;
}

export const badgeRegenerationInput = (input: unknown): Input => {
  try {
    return Schema.decodeUnknownSync(BadgeRegenerationInput, {
      onExcessProperty: "error",
    })(input);
  } catch (error) {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Los datos del carnet no son válidos",
      false,
      { issues: String(error) },
    );
  }
};

export const updateBadgeProfile = async (
  identity: BadgeIdentity,
  input: Input,
): Promise<string> => {
  const [record] = await db
    .select({ application: applications, badge: participantBadges })
    .from(applications)
    .innerJoin(participants, eq(participants.id, applications.participantId))
    .innerJoin(
      acceptanceDetails,
      eq(acceptanceDetails.applicationId, applications.id),
    )
    .leftJoin(
      participantBadges,
      eq(participantBadges.applicationId, applications.id),
    )
    .where(
      and(
        eq(participants.clerkUserId, identity.clerkUserId),
        eq(applications.status, "accepted"),
        isNotNull(acceptanceDetails.completedAt),
      ),
    )
    .limit(1);
  if (!record) {
    throw new HttpError(
      409,
      "ATTENDANCE_NOT_CONFIRMED",
      "Confirma tu asistencia antes de regenerar tu carnet",
    );
  }

  const values: typeof participantBadges.$inferInsert = {
    applicationId: record.application.id,
    oneLiner: input.oneLiner,
    linkUrl: input.linkUrl,
    status: "pending",
    generationId: null,
    triggerRunId: null,
  };
  const updates: Partial<typeof participantBadges.$inferInsert> = {
    oneLiner: input.oneLiner,
    linkUrl: input.linkUrl,
    status: "pending",
    generationId: null,
    triggerRunId: null,
    error: null,
    updatedAt: new Date(),
  };
  if (input.pictureSource) {
    const pictureUrl = confirmedPictureUrl(input.pictureSource, {
      clerkPictureUrl: identity.clerkPictureUrl,
      githubUrl: record.application.githubUrl,
      uploadedPictureUrl: record.badge?.customPictureUrl,
    });
    values.pictureSource = input.pictureSource;
    values.pictureUrl = pictureUrl;
    updates.pictureSource = input.pictureSource;
    updates.pictureUrl = pictureUrl;
  }

  const badgeUpdate = db
    .insert(participantBadges)
    .values(values)
    .onConflictDoUpdate({
      target: participantBadges.applicationId,
      set: updates,
    });
  const participantValues: Partial<typeof participants.$inferInsert> = {
    name: input.fullName,
    updatedAt: new Date(),
  };
  if (input.tangledUrl !== undefined)
    participantValues.tangledUrl = input.tangledUrl;
  const participantUpdate = db
    .update(participants)
    .set(participantValues)
    .where(eq(participants.id, record.application.participantId));
  await db.batch([participantUpdate, badgeUpdate]);

  return record.application.id;
};
