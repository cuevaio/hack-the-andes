import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { auditTimestamps } from "./common";
import {
  applicationStatus,
  participationMode,
  pictureSource,
  teamPreference,
} from "./enums";
import { participants } from "./participants";

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    status: applicationStatus("status").default("draft").notNull(),

    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    email: varchar("email", { length: 320 }),
    pronouns: varchar("pronouns", { length: 50 }),
    city: varchar("city", { length: 120 }),
    participationMode: participationMode("participation_mode"),
    organization: varchar("organization", { length: 200 }),
    role: varchar("role", { length: 120 }),
    phone: varchar("phone", { length: 32 }),
    fieldOfStudy: varchar("field_of_study", { length: 160 }),
    graduationYear: integer("graduation_year"),
    shippedProject: text("shipped_project"),
    hackathonProject: text("hackathon_project"),
    bio: text("bio"),
    githubUrl: text("github_url"),
    linkedInUrl: text("linkedin_url"),
    portfolioUrl: text("portfolio_url"),
    pictureSource: pictureSource("picture_source"),
    pictureUrl: text("picture_url"),
    customPictureUrl: text("custom_picture_url"),
    customPicturePathname: text("custom_picture_pathname"),
    pendingPicturePathname: text("pending_picture_pathname"),
    pendingPictureExpiresAt: timestamp("pending_picture_expires_at", {
      withTimezone: true,
    }),
    pictureUploadWindowStartedAt: timestamp(
      "picture_upload_window_started_at",
      { withTimezone: true },
    ),
    pictureUploadCount: integer("picture_upload_count").default(0).notNull(),
    teamPreference: teamPreference("team_preference"),
    teamName: varchar("team_name", { length: 120 }),

    codeOfConductAcceptedAt: timestamp("code_of_conduct_accepted_at", {
      withTimezone: true,
    }),
    privacyPolicyAcceptedAt: timestamp("privacy_policy_accepted_at", {
      withTimezone: true,
    }),
    mediaConsent: boolean("media_consent").default(false).notNull(),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedByClerkUserId: varchar("decided_by_clerk_user_id", { length: 255 }),
    rejectionReason: text("rejection_reason"),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("applications_one_active_per_participant")
      .on(table.participantId)
      .where(
        sql`${table.status} in ('draft', 'submitted', 'under_review', 'waitlisted', 'accepted')`,
      ),
    index("applications_status_index").on(table.status),
  ],
);

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
