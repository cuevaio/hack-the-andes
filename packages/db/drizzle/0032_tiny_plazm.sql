CREATE TABLE "checkin_tokens" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_by" text
);
--> statement-breakpoint
CREATE TABLE "hackathon_settings" (
	"id" text PRIMARY KEY DEFAULT 'event' NOT NULL,
	"selection_open" boolean DEFAULT false NOT NULL,
	"changed_by" text,
	"changed_at" timestamp with time zone,
	CONSTRAINT "hackathon_settings_singleton" CHECK ("hackathon_settings"."id" = 'event')
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"participant_id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	CONSTRAINT "team_members_slot_valid" CHECK ("team_members"."slot" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"track" text,
	"track_slot" integer,
	"track_changed_by" uuid,
	"track_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_track_valid" CHECK (("teams"."track" is null and "teams"."track_slot" is null) or ("teams"."track" is not null and "teams"."track" in ('environmental','security','transport') and "teams"."track_slot" is not null and "teams"."track_slot" between 1 and 12))
);
--> statement-breakpoint
ALTER TABLE "checkin_tokens" ADD CONSTRAINT "checkin_tokens_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_track_changed_by_participants_id_fk" FOREIGN KEY ("track_changed_by") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkin_tokens_hash_unique" ON "checkin_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invitations_recipient_unique" ON "team_invitations" USING btree ("team_id","participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_slot_unique" ON "team_members" USING btree ("team_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_track_slot_unique" ON "teams" USING btree ("track","track_slot");