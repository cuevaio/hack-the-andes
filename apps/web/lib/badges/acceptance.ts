import { db } from "@chofex/db";
import { and, eq, isNull } from "@chofex/db/orm";
import { participantBadges, participants } from "@chofex/db/schema";

import { acceptanceBadgeProfileFor } from "@/lib/credential/profile";

interface AcceptanceBadgeCandidate {
  readonly id: string;
  readonly participantId: string;
  readonly name: string;
  readonly role?: string;
  readonly badgePictureUrl?: string;
  readonly portfolioUrl?: string;
  readonly githubUrl?: string;
  readonly tangledUrl?: string;
  readonly linkedInUrl?: string;
}

/**
 * Freezes the reviewer-visible identity as the participant's first badge
 * profile. Later confirmation edits the badge profile, not the historical
 * application that the reviewer accepted.
 */
export const storeAcceptanceBadgeProfile = async (
  candidate: AcceptanceBadgeCandidate,
): Promise<void> => {
  const profile = acceptanceBadgeProfileFor({
    role: candidate.role,
    avatarUrl: candidate.badgePictureUrl,
    websiteUrl: candidate.portfolioUrl,
    githubUrl: candidate.githubUrl,
    tangledUrl: candidate.tangledUrl,
    linkedInUrl: candidate.linkedInUrl,
  });

  const badgeInsert = db
    .insert(participantBadges)
    .values({
      applicationId: candidate.id,
      status: "pending",
      generationId: null,
      triggerRunId: null,
      ...profile,
    })
    .onConflictDoUpdate({
      target: participantBadges.applicationId,
      set: {
        status: "pending",
        generationId: null,
        triggerRunId: null,
        error: null,
        oneLiner: profile.oneLiner,
        linkUrl: profile.linkUrl,
        pictureUrl: profile.pictureUrl ?? null,
        updatedAt: new Date(),
      },
    });
  const participantUpdate = db
    .update(participants)
    .set({ name: candidate.name, updatedAt: new Date() })
    .where(
      and(
        eq(participants.id, candidate.participantId),
        isNull(participants.name),
      ),
    );
  await db.batch([participantUpdate, badgeInsert]);
};
