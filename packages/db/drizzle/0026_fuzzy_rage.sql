ALTER TABLE "acceptance_details" DROP CONSTRAINT "acceptance_details_completed_fields_required";--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "legal_name" varchar(200);--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "name_sync_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "name_sync_after" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "participants_name_sync_after_index" ON "participants" USING btree ("name_sync_after");--> statement-breakpoint
UPDATE "participants" SET "name" = NULL WHERE trim("name") = '';--> statement-breakpoint
UPDATE "participants" AS participant
SET "legal_name" = latest."full_name"
FROM (
  SELECT DISTINCT ON (application."participant_id")
    application."participant_id", trim(details."full_name") AS "full_name"
  FROM "acceptance_details" AS details
  JOIN "applications" AS application ON application."id" = details."application_id"
  WHERE nullif(trim(details."full_name"), '') IS NOT NULL
  ORDER BY application."participant_id", details."updated_at" DESC, details."id" DESC
) AS latest
WHERE participant."id" = latest."participant_id";--> statement-breakpoint
ALTER TABLE "acceptance_details" DROP COLUMN "full_name";--> statement-breakpoint
ALTER TABLE "acceptance_details" ADD CONSTRAINT "acceptance_details_completed_fields_required" CHECK ("acceptance_details"."completed_at" is null or (
        "acceptance_details"."date_of_birth" is not null and
        "acceptance_details"."national_id_number" is not null and
        "acceptance_details"."emergency_contact_name" is not null and
        "acceptance_details"."emergency_contact_phone" is not null
      ));
--> statement-breakpoint
CREATE FUNCTION "schedule_participant_name_sync"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."name_sync_token" := gen_random_uuid();
  NEW."name_sync_after" := now();
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "participant_name_changed"
BEFORE UPDATE OF "name" ON "participants"
FOR EACH ROW WHEN (OLD."name" IS DISTINCT FROM NEW."name")
EXECUTE FUNCTION "schedule_participant_name_sync"();
