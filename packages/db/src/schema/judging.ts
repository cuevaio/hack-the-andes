import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const judgingJudges = pgTable("judging_judges", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
});

export const judgingPresentations = pgTable(
  "judging_presentations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().unique(),
    snapshot: jsonb("snapshot").notNull(),
    position: integer("position").notNull(),
    status: text("status").notNull().default("queued"),
    presentedAt: timestamp("presented_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "judging_presentation_status",
      sql`${t.status} in ('queued','current','finished','skipped')`,
    ),
  ],
);

export const judgingSession = pgTable(
  "judging_session",
  {
    id: text("id").primaryKey().default("event"),
    initializedAt: timestamp("initialized_at", { withTimezone: true }),
    currentPresentationId: uuid("current_presentation_id"),
    revision: integer("revision").notNull().default(0),
    remainingMs: integer("remaining_ms").notNull().default(0),
    runningSince: timestamp("running_since", { withTimezone: true }),
    changedBy: text("changed_by"),
  },
  (t) => [
    check("judging_singleton", sql`${t.id} = 'event'`),
    check("judging_timer_range", sql`${t.remainingMs} between 0 and 300000`),
  ],
);

export const judgingEvaluations = pgTable(
  "judging_evaluations",
  {
    presentationId: uuid("presentation_id")
      .notNull()
      .references(() => judgingPresentations.id),
    judgeId: text("judge_id")
      .notNull()
      .references(() => judgingJudges.clerkUserId),
    traction: integer("traction"),
    technical: integer("technical"),
    pitch: integer("pitch"),
    notes: text("notes").notNull().default(""),
    revision: integer("revision").notNull().default(0),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reopenedBy: text("reopened_by"),
  },
  (t) => [
    primaryKey({ columns: [t.presentationId, t.judgeId] }),
    check(
      "judging_scores_range",
      sql`(${t.traction} is null or ${t.traction} between 1 and 5) and (${t.technical} is null or ${t.technical} between 1 and 5) and (${t.pitch} is null or ${t.pitch} between 1 and 5)`,
    ),
    check(
      "judging_submission_complete",
      sql`${t.submittedAt} is null or (${t.traction} is not null and ${t.technical} is not null and ${t.pitch} is not null)`,
    ),
  ],
);
