ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "country_code" varchar(2);--> statement-breakpoint
UPDATE "participants" AS p
SET "country_code" = latest."country_code"
FROM (
  SELECT DISTINCT ON ("participant_id") "participant_id", "country_code"
  FROM "applications"
  WHERE "country_code" IS NOT NULL AND "country_code" <> 'PE'
  ORDER BY "participant_id", "created_at" DESC, "id" DESC
) AS latest
WHERE p."id" = latest."participant_id"
  AND p."country_code" IS NULL;--> statement-breakpoint
ALTER TABLE "applications" DROP COLUMN "country_code";
