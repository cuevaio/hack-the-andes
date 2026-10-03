import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { participants } from "./participants";

export const participantFunnelStage = pgEnum("participant_funnel_stage", [
  "registered",
  "draft",
  "submitted",
  "challenge_started",
  "challenge_completed",
  "under_review",
  "waitlisted",
  "accepted",
  "confirmed",
  "rejected",
  "withdrawn",
  "checked_in",
]);

export const participantFunnelMilestones = pgTable(
  "participant_funnel_milestones",
  {
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    stage: participantFunnelStage("stage").notNull(),
    reachedAt: timestamp("reached_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.participantId, table.stage] }),
    index("participant_funnel_milestones_stage_date_index").on(
      table.stage,
      table.reachedAt,
    ),
  ],
);

export type ParticipantFunnelMilestone =
  typeof participantFunnelMilestones.$inferSelect;
