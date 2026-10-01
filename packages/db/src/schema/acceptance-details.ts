import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { applications } from "./applications";
import { auditTimestamps } from "./common";
import { shirtSize } from "./enums";

export const acceptanceDetails = pgTable(
  "acceptance_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),

    phone: varchar("phone", { length: 32 }),
    dateOfBirth: date("date_of_birth", { mode: "date" }),
    nationalIdNumber: text("national_id_number"),
    shirtSize: shirtSize("shirt_size"),
    dietaryRestrictions: text("dietary_restrictions"),
    accessibilityNeeds: text("accessibility_needs"),
    emergencyContactName: varchar("emergency_contact_name", { length: 200 }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 32 }),
    mediaConsent: boolean("media_consent").default(false).notNull(),

    completedAt: timestamp("completed_at", { withTimezone: true }),
    firstCompletedAt: timestamp("first_completed_at", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("acceptance_details_application_id_unique").on(
      table.applicationId,
    ),
    check(
      "acceptance_details_completed_fields_required",
      sql`${table.completedAt} is null or (
        ${table.dateOfBirth} is not null and
        ${table.nationalIdNumber} is not null and
        ${table.emergencyContactName} is not null and
        ${table.emergencyContactPhone} is not null
      )`,
    ),
  ],
);

export type AcceptanceDetails = typeof acceptanceDetails.$inferSelect;
export type NewAcceptanceDetails = typeof acceptanceDetails.$inferInsert;
