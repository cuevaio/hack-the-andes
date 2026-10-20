import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { applications } from "./applications";

export const participationCertificates = pgTable(
  "participation_certificates",
  {
    id: varchar("id", { length: 41 })
      .primaryKey()
      .default(
        sql`'HTA-2026-' || upper(replace(gen_random_uuid()::text, '-', ''))`,
      ),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    recipientName: varchar("recipient_name", { length: 200 }).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("participation_certificates_application_unique").on(
      table.applicationId,
    ),
    check(
      "participation_certificates_name_required",
      sql`length(btrim(${table.recipientName})) > 0`,
    ),
    check(
      "participation_certificates_id_format",
      sql`${table.id} ~ '^HTA-2026-[A-F0-9]{32}$'`,
    ),
  ],
);

export const participationCertificateDeliveries = pgTable(
  "participation_certificate_deliveries",
  {
    certificateId: varchar("certificate_id", { length: 41 })
      .primaryKey()
      .references(() => participationCertificates.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("sending"),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    providerId: text("provider_id"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
  },
  (table) => [
    check(
      "participation_certificate_delivery_status",
      sql`${table.status} in ('sending', 'sent', 'failed')`,
    ),
  ],
);
