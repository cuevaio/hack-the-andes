import { and, eq } from "@chofex/db/orm";
import {
  acceptanceDetails,
  applications,
  participantBadges,
  participants,
} from "@chofex/db/schema";
import { db } from "@chofex/db/worker";
import { logger, task } from "@trigger.dev/sdk";

import { sendBadgeReadyEmail } from "../lib/badges/email";
import { resolveBadgeProfile } from "../lib/credential/profile";
import { generateBadge } from "./generate-badge";
import { generatePortrait } from "./generate-portrait";

/** Where the email sends people to find the card itself. */
const BADGE_PAGE_URL =
  "https://hacktheandes.com/badge?utm_source=resend&utm_medium=email&utm_campaign=badge&utm_content=view";

export interface GenerateParticipantBadgePayload {
  readonly applicationId: string;
  readonly generationId: string;
  readonly notification?: {
    readonly kind: "acceptance";
    readonly message?: string;
  };
}

export const generateParticipantBadge = task<
  "generate-participant-badge",
  GenerateParticipantBadgePayload,
  { readonly badgeUrl: string; readonly portraitUrl: string | null }
>({
  id: "generate-participant-badge",
  queue: { concurrencyLimit: 5 },
  maxDuration: 900,
  onFailure: async ({ payload, error }) => {
    const [badge] = await db
      .select({
        badgeUrl: participantBadges.badgeUrl,
        generationId: participantBadges.generationId,
      })
      .from(participantBadges)
      .where(eq(participantBadges.applicationId, payload.applicationId))
      .limit(1);
    if (badge?.generationId !== payload.generationId) return;
    let message = String(error).slice(0, 4_000);
    if (badge?.badgeUrl) {
      message = `Badge created but notification failed: ${message}`;
    }
    await db
      .update(participantBadges)
      .set({
        status: "failed",
        error: message,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(participantBadges.applicationId, payload.applicationId),
          eq(participantBadges.generationId, payload.generationId),
        ),
      );
  },
  run: async (payload: GenerateParticipantBadgePayload) => {
    const [record] = await db
      .select({
        application: applications,
        details: acceptanceDetails,
        badge: participantBadges,
        participantName: participants.name,
      })
      .from(applications)
      .innerJoin(participants, eq(participants.id, applications.participantId))
      .leftJoin(
        acceptanceDetails,
        eq(acceptanceDetails.applicationId, applications.id),
      )
      .leftJoin(
        participantBadges,
        eq(participantBadges.applicationId, applications.id),
      )
      .where(eq(applications.id, payload.applicationId))
      .limit(1);
    if (!record) throw new Error("Application not found");
    if (record.application.status !== "accepted") {
      throw new Error("Only accepted participants can receive a badge");
    }
    const profile = resolveBadgeProfile(
      {
        ...record.application,
        name: record.participantName,
        websiteUrl: record.application.portfolioUrl,
      },
      record.badge,
    );
    const pictureUrl = profile.pictureUrl;
    const fullName = profile.fullName;
    if (!fullName) throw new Error("Participant has no name");
    const email = record.application.email;
    if (!email) throw new Error("Participant has no email address");

    const [claimed] = await db
      .update(participantBadges)
      .set({ status: "running", error: null, updatedAt: new Date() })
      .where(
        and(
          eq(participantBadges.applicationId, payload.applicationId),
          eq(participantBadges.generationId, payload.generationId),
        ),
      )
      .returning({ applicationId: participantBadges.applicationId });
    if (!claimed) throw new Error("Badge generation was superseded");

    logger.info("Starting participant badge workflow", {
      applicationId: payload.applicationId,
    });
    let portraitUrl: string | undefined;
    if (pictureUrl) {
      const portrait = await generatePortrait
        .triggerAndWait(
          {
            applicationId: payload.applicationId,
            generationId: payload.generationId,
            pictureUrl,
          },
          { idempotencyKey: `portrait/${payload.generationId}` },
        )
        .unwrap();
      portraitUrl = portrait.url;
    }
    const badge = await generateBadge
      .triggerAndWait(
        {
          applicationId: payload.applicationId,
          generationId: payload.generationId,
          fullName,
          oneLiner: profile.oneLiner,
          placement: profile.placement,
          linkUrl: profile.linkUrl,
          portraitUrl,
        },
        { idempotencyKey: `badge/${payload.generationId}` },
      )
      .unwrap();

    const [completed] = await db
      .update(participantBadges)
      .set({ status: "completed", error: null, updatedAt: new Date() })
      .where(
        and(
          eq(participantBadges.applicationId, payload.applicationId),
          eq(participantBadges.generationId, payload.generationId),
        ),
      )
      .returning({ applicationId: participantBadges.applicationId });
    if (!completed) {
      logger.info("Skipping notification for superseded badge generation", {
        applicationId: payload.applicationId,
      });
      return { badgeUrl: badge.url, portraitUrl: portraitUrl ?? null };
    }
    await sendBadgeReadyEmail({
      applicationId: payload.applicationId,
      email,
      firstName: record.application.firstName ?? fullName,
      badgeUrl: badge.url,
      placement: profile.placement,
      badgePageUrl: BADGE_PAGE_URL,
      requiresConfirmation: !record.details?.completedAt,
      generationId: payload.generationId,
      notification: payload.notification,
    });
    await db
      .update(participantBadges)
      .set({ notificationSentAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(participantBadges.applicationId, payload.applicationId),
          eq(participantBadges.generationId, payload.generationId),
        ),
      );

    return { badgeUrl: badge.url, portraitUrl: portraitUrl ?? null };
  },
});
