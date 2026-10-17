import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { applications } from "./applications";
import { participants } from "./participants";

export const hackathonSettings = pgTable(
  "hackathon_settings",
  {
    id: text("id").primaryKey().default("event"),
    galleryVisible: boolean("gallery_visible").notNull().default(false),
    selectionOpen: boolean("selection_open").notNull().default(false),
    changedBy: text("changed_by"),
    changedAt: timestamp("changed_at", { withTimezone: true }),
  },
  (t) => [check("hackathon_settings_singleton", sql`${t.id} = 'event'`)],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    track: text("track"),
    trackSlot: integer("track_slot"),
    trackChangedBy: uuid("track_changed_by").references(() => participants.id, {
      onDelete: "set null",
    }),
    trackChangedAt: timestamp("track_changed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("teams_track_slot_unique").on(t.track, t.trackSlot),
    check(
      "teams_track_valid",
      sql`(${t.track} is null and ${t.trackSlot} is null) or (${t.track} is not null and ${t.track} in ('environmental','transport','education','security') and ${t.trackSlot} is not null and ${t.trackSlot} between 1 and 12)`,
    ),
  ],
);

export const teamMembers = pgTable(
  "team_members",
  {
    participantId: uuid("participant_id")
      .primaryKey()
      .references(() => participants.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
  },
  (t) => [
    uniqueIndex("team_members_slot_unique").on(t.teamId, t.slot),
    check("team_members_slot_valid", sql`${t.slot} between 1 and 4`),
  ],
);

export const teamInvitations = pgTable(
  "team_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("team_invitations_recipient_unique").on(
      t.teamId,
      t.participantId,
    ),
  ],
);

export const checkinTokens = pgTable(
  "checkin_tokens",
  {
    applicationId: uuid("application_id")
      .primaryKey()
      .references(() => applications.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    confirmedBy: text("confirmed_by"),
  },
  (t) => [uniqueIndex("checkin_tokens_hash_unique").on(t.tokenHash)],
);
