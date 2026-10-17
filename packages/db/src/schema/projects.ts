import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { participants } from "./participants";
import { teams } from "./teams";
export const projectSubmissions = pgTable("project_submissions", {
  teamId: uuid("team_id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  deploymentUrl: text("deployment_url").notNull(),
  presentationUrl: text("presentation_url").notNull(),
  githubUrl: text("github_url"),
  description: text("description").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const projectUpdates = pgTable(
  "project_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => participants.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("project_updates_team_created_idx").on(t.teamId, t.createdAt)],
);

export const projectArchives = pgTable("project_archives", {
  teamId: uuid("team_id").primaryKey(),
  snapshot: jsonb("snapshot").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
