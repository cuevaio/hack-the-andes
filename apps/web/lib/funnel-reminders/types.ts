export const funnelReminderStages = [
  "registration",
  "challenge_start",
  "challenge_finish",
] as const;

export type FunnelReminderStage = (typeof funnelReminderStages)[number];

export interface FunnelReminderRecipient {
  readonly email: string;
  readonly firstName: string;
}

export interface FunnelReminderPayload {
  readonly clerkUserId: string;
  readonly stage: FunnelReminderStage;
  readonly applicationId?: string;
  readonly challengeSlug?: string;
  readonly recipient?: FunnelReminderRecipient;
}
