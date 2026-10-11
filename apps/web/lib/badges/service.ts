import { db } from "@chofex/db";
import { and, desc, eq } from "@chofex/db/orm";
import {
  applications,
  participantBadges,
  participants,
} from "@chofex/db/schema";
import type { BadgeProfile, BadgeResult } from "@chofex/registration-contract";
import { resolveBadgeProfile } from "@/lib/credential/profile";

const profileFor = (
  application: typeof applications.$inferSelect,
  badge: typeof participantBadges.$inferSelect | null,
  participantName: string | null,
  tangledUrl: string | null,
): BadgeProfile => {
  const resolved = resolveBadgeProfile(
    {
      ...application,
      name: participantName,
      tangledUrl,
      websiteUrl: application.portfolioUrl,
    },
    badge,
  );
  return {
    fullName: resolved.fullName,
    oneLiner: resolved.oneLiner,
    linkUrl: resolved.linkUrl,
    placement: resolved.placement,
  };
};

export const getParticipantBadge = async (
  clerkUserId: string,
): Promise<BadgeResult> => {
  const [record] = await db
    .select({
      application: applications,
      badge: participantBadges,
      participantName: participants.name,
      tangledUrl: participants.tangledUrl,
    })
    .from(participants)
    .innerJoin(applications, eq(applications.participantId, participants.id))
    .leftJoin(
      participantBadges,
      eq(participantBadges.applicationId, applications.id),
    )
    .where(
      and(
        eq(participants.clerkUserId, clerkUserId),
        eq(applications.status, "accepted"),
      ),
    )
    .orderBy(desc(applications.createdAt))
    .limit(1);

  if (!record) return { status: "not_started" };
  const profile = profileFor(
    record.application,
    record.badge,
    record.participantName,
    record.tangledUrl,
  );
  if (!record.badge) return { status: "not_started", profile };
  if (record.badge.status === "completed" && record.badge.badgeUrl) {
    return { status: "completed", url: record.badge.badgeUrl, profile };
  }
  return { status: record.badge.status, profile };
};
