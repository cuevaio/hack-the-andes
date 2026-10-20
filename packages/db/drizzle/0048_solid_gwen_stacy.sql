CREATE TABLE "participation_certificate_deliveries" (
	"certificate_id" varchar(41) PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"status" varchar(16) DEFAULT 'sending' NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"provider_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "participation_certificate_delivery_status" CHECK ("participation_certificate_deliveries"."status" in ('sending', 'sent', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "participation_certificate_deliveries" ADD CONSTRAINT "participation_certificate_deliveries_certificate_id_participation_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."participation_certificates"("id") ON DELETE cascade ON UPDATE no action;