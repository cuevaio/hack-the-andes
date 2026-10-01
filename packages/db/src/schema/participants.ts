import { pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { auditTimestamps } from "./common";

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 200 }),
    countryCode: varchar("country_code", { length: 2 }),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("participants_clerk_user_id_unique").on(table.clerkUserId),
  ],
);

export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
