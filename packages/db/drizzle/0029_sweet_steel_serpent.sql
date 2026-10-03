CREATE TYPE "public"."participant_funnel_stage" AS ENUM('registered', 'draft', 'submitted', 'challenge_started', 'challenge_completed', 'under_review', 'waitlisted', 'accepted', 'confirmed', 'rejected', 'withdrawn', 'checked_in');--> statement-breakpoint
CREATE TABLE "participant_funnel_milestones" (
	"participant_id" uuid NOT NULL,
	"stage" "participant_funnel_stage" NOT NULL,
	"reached_at" timestamp with time zone NOT NULL,
	CONSTRAINT "participant_funnel_milestones_participant_id_stage_pk" PRIMARY KEY("participant_id","stage")
);
--> statement-breakpoint
ALTER TABLE "participant_funnel_milestones" ADD CONSTRAINT "participant_funnel_milestones_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participant_funnel_milestones_stage_date_index" ON "participant_funnel_milestones" USING btree ("stage","reached_at");--> statement-breakpoint
CREATE FUNCTION record_participant_funnel_milestone(person_id uuid, milestone participant_funnel_stage, reached timestamptz)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO participant_funnel_milestones (participant_id, stage, reached_at)
  SELECT person_id, milestone, reached WHERE reached IS NOT NULL
  ON CONFLICT (participant_id, stage) DO UPDATE
    SET reached_at = excluded.reached_at
    WHERE excluded.reached_at < participant_funnel_milestones.reached_at;
$$;
--> statement-breakpoint
CREATE FUNCTION capture_participant_funnel_milestones()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  person_id uuid;
  reached timestamptz;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'participants' THEN
      PERFORM record_participant_funnel_milestone(NEW.id, 'registered', NEW.created_at);
    WHEN 'applications' THEN
      PERFORM record_participant_funnel_milestone(NEW.participant_id, 'draft', NEW.created_at);
      PERFORM record_participant_funnel_milestone(NEW.participant_id, 'submitted', NEW.submitted_at);
      IF NEW.status IN ('accepted', 'rejected') THEN
        PERFORM record_participant_funnel_milestone(NEW.participant_id, NEW.status::text::participant_funnel_stage, NEW.decided_at);
      END IF;
      IF TG_OP = 'UPDATE' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
          reached := statement_timestamp();
          IF NEW.status IN ('accepted', 'rejected') AND NEW.decided_at IS DISTINCT FROM OLD.decided_at THEN
            reached := COALESCE(NEW.decided_at, reached);
          ELSIF NEW.status = 'submitted' THEN
            reached := COALESCE(NEW.submitted_at, reached);
          END IF;
          PERFORM record_participant_funnel_milestone(NEW.participant_id, NEW.status::text::participant_funnel_stage, reached);
        END IF;
      ELSIF NEW.status IN ('accepted', 'rejected') THEN
        PERFORM record_participant_funnel_milestone(NEW.participant_id, NEW.status::text::participant_funnel_stage, COALESCE(NEW.decided_at, statement_timestamp()));
      ELSIF NEW.status IN ('under_review', 'waitlisted', 'withdrawn') THEN
        PERFORM record_participant_funnel_milestone(NEW.participant_id, NEW.status::text::participant_funnel_stage, statement_timestamp());
      END IF;
    WHEN 'challenge_attempts' THEN
      PERFORM record_participant_funnel_milestone(NEW.participant_id, 'challenge_started', NEW.created_at);
    WHEN 'challenge_evaluations' THEN
      SELECT participant_id INTO person_id FROM challenge_attempts WHERE id = NEW.attempt_id;
      PERFORM record_participant_funnel_milestone(person_id, 'challenge_completed', NEW.created_at);
    WHEN 'acceptance_details' THEN
      SELECT participant_id INTO person_id FROM applications WHERE id = NEW.application_id;
      reached := NEW.first_completed_at;
      IF TG_OP = 'INSERT' THEN
        reached := COALESCE(reached, NEW.completed_at);
      ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
          reached := COALESCE(reached, NEW.completed_at);
        END IF;
      END IF;
      PERFORM record_participant_funnel_milestone(person_id, 'confirmed', reached);
      PERFORM record_participant_funnel_milestone(person_id, 'checked_in', NEW.checked_in_at);
  END CASE;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER participants_capture_funnel_milestones
AFTER INSERT ON participants FOR EACH ROW EXECUTE FUNCTION capture_participant_funnel_milestones();
--> statement-breakpoint
CREATE TRIGGER applications_capture_funnel_milestones
AFTER INSERT OR UPDATE OF status, submitted_at, decided_at ON applications
FOR EACH ROW EXECUTE FUNCTION capture_participant_funnel_milestones();
--> statement-breakpoint
CREATE TRIGGER challenge_attempts_capture_funnel_milestones
AFTER INSERT ON challenge_attempts FOR EACH ROW EXECUTE FUNCTION capture_participant_funnel_milestones();
--> statement-breakpoint
CREATE TRIGGER challenge_evaluations_capture_funnel_milestones
AFTER INSERT ON challenge_evaluations FOR EACH ROW EXECUTE FUNCTION capture_participant_funnel_milestones();
--> statement-breakpoint
CREATE TRIGGER acceptance_details_capture_funnel_milestones
AFTER INSERT OR UPDATE OF completed_at, first_completed_at, checked_in_at ON acceptance_details
FOR EACH ROW EXECUTE FUNCTION capture_participant_funnel_milestones();
--> statement-breakpoint
-- Backfill only dates that were explicitly recorded. Current status and updated_at
-- cannot date past review, waitlist, withdrawal, or legacy first confirmations.
INSERT INTO participant_funnel_milestones (participant_id, stage, reached_at)
SELECT participant_id, stage::participant_funnel_stage, min(reached_at)
FROM (
  SELECT id AS participant_id, 'registered' AS stage, created_at AS reached_at FROM participants
  UNION ALL SELECT participant_id, 'draft', created_at FROM applications
  UNION ALL SELECT participant_id, 'submitted', submitted_at FROM applications
  UNION ALL SELECT participant_id, 'challenge_started', created_at FROM challenge_attempts
  UNION ALL SELECT a.participant_id, 'challenge_completed', e.created_at
    FROM challenge_evaluations e JOIN challenge_attempts a ON a.id = e.attempt_id
  UNION ALL SELECT participant_id, status::text, decided_at FROM applications WHERE status IN ('accepted', 'rejected')
  UNION ALL SELECT a.participant_id, 'confirmed', d.first_completed_at
    FROM acceptance_details d JOIN applications a ON a.id = d.application_id
  UNION ALL SELECT a.participant_id, 'checked_in', d.checked_in_at
    FROM acceptance_details d JOIN applications a ON a.id = d.application_id
) AS events
WHERE reached_at IS NOT NULL
GROUP BY participant_id, stage
ON CONFLICT (participant_id, stage) DO UPDATE
  SET reached_at = excluded.reached_at
    WHERE excluded.reached_at < participant_funnel_milestones.reached_at;
