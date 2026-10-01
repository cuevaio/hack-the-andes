import type { ParticipantChallengeProgress } from "@chofex/challenges-contract";
import { db } from "@chofex/db";
import { and, desc, eq, inArray } from "@chofex/db/orm";
import { applications, participants } from "@chofex/db/schema";
import { tasks } from "@trigger.dev/sdk";

import type { sendFunnelReminder } from "../../trigger/send-funnel-reminder";
import { currentChallengeVersionFor } from "../challenges/engine";
import { reminderChallenge } from "./challenge";
import type { FunnelReminderPayload } from "./types";

export const funnelReminderDelay = "2h";

const challengeCandidateStatuses = [
  "submitted",
  "under_review",
  "waitlisted",
] as const;

export const challengeReminderApplicationIdFor = async (
  clerkUserId: string,
): Promise<string | undefined> => {
  const [application] = await db
    .select({ id: applications.id })
    .from(participants)
    .innerJoin(applications, eq(applications.participantId, participants.id))
    .where(
      and(
        eq(participants.clerkUserId, clerkUserId),
        inArray(applications.status, challengeCandidateStatuses),
      ),
    )
    .orderBy(desc(applications.createdAt))
    .limit(1);
  return application?.id;
};

export const enqueueFunnelReminder = async (
  payload: FunnelReminderPayload,
  idempotencyKeySuffix = "event",
): Promise<void> => {
  await tasks.trigger<typeof sendFunnelReminder>(
    "send-funnel-reminder",
    payload,
    {
      delay: funnelReminderDelay,
      idempotencyKey: `funnel-reminder/${payload.stage}/${payload.clerkUserId}/${idempotencyKeySuffix}`,
      idempotencyKeyTTL: "7d",
      tags: [`funnel_${payload.stage}`, `clerk_user_${payload.clerkUserId}`],
    },
  );
};

export const enqueueFunnelReminderBestEffort = async (
  payload: FunnelReminderPayload,
  idempotencyKeySuffix?: string,
): Promise<void> => {
  try {
    await enqueueFunnelReminder(payload, idempotencyKeySuffix);
  } catch (error) {
    console.error("Could not schedule funnel reminder", {
      clerkUserId: payload.clerkUserId,
      stage: payload.stage,
      error,
    });
  }
};

export const enqueuePostSubmissionRemindersBestEffort = async (
  clerkUserId: string,
  applicationId: string,
  progress: ReadonlyArray<ParticipantChallengeProgress>,
): Promise<void> => {
  const started = progress.find(
    (challenge) =>
      challenge.playable &&
      challenge.open &&
      challenge.status === "in_progress",
  );
  const challenge = reminderChallenge({ slug: started?.slug });
  if (!challenge) return;
  const idempotencyKeySuffix = `application/${applicationId}/${challenge.slug}/${currentChallengeVersionFor(challenge.slug)}`;
  await enqueueFunnelReminderBestEffort(
    {
      clerkUserId,
      stage: "challenge_start",
      applicationId,
      challengeSlug: challenge.slug,
    },
    idempotencyKeySuffix,
  );
  if (started) {
    await enqueueFunnelReminderBestEffort(
      {
        clerkUserId,
        stage: "challenge_finish",
        applicationId,
        challengeSlug: challenge.slug,
      },
      idempotencyKeySuffix,
    );
  }
};

export const enqueueChallengeFinishReminderBestEffort = async (
  clerkUserId: string,
  applicationId: string | undefined,
  challengeSlug: string,
): Promise<void> => {
  if (!applicationId) return;
  const challenge = reminderChallenge({ slug: challengeSlug });
  if (!challenge) return;
  await enqueueFunnelReminderBestEffort(
    {
      clerkUserId,
      stage: "challenge_finish",
      applicationId,
      challengeSlug: challenge.slug,
    },
    `application/${applicationId}/${challenge.slug}/${currentChallengeVersionFor(challenge.slug)}`,
  );
};
