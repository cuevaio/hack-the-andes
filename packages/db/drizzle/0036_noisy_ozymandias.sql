CREATE TABLE "judging_evaluations" (
	"presentation_id" uuid NOT NULL,
	"judge_id" text NOT NULL,
	"traction" integer,
	"technical" integer,
	"pitch" integer,
	"notes" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reopened_by" text,
	CONSTRAINT "judging_evaluations_presentation_id_judge_id_pk" PRIMARY KEY("presentation_id","judge_id"),
	CONSTRAINT "judging_scores_range" CHECK (("judging_evaluations"."traction" is null or "judging_evaluations"."traction" between 1 and 5) and ("judging_evaluations"."technical" is null or "judging_evaluations"."technical" between 1 and 5) and ("judging_evaluations"."pitch" is null or "judging_evaluations"."pitch" between 1 and 5)),
	CONSTRAINT "judging_submission_complete" CHECK ("judging_evaluations"."submitted_at" is null or ("judging_evaluations"."traction" is not null and "judging_evaluations"."technical" is not null and "judging_evaluations"."pitch" is not null))
);
--> statement-breakpoint
CREATE TABLE "judging_judges" (
	"clerk_user_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judging_presentations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"presented_at" timestamp with time zone,
	CONSTRAINT "judging_presentations_team_id_unique" UNIQUE("team_id"),
	CONSTRAINT "judging_presentation_status" CHECK ("judging_presentations"."status" in ('queued','current','finished','skipped'))
);
--> statement-breakpoint
CREATE TABLE "judging_session" (
	"id" text PRIMARY KEY DEFAULT 'event' NOT NULL,
	"initialized_at" timestamp with time zone,
	"current_presentation_id" uuid,
	"revision" integer DEFAULT 0 NOT NULL,
	"remaining_ms" integer DEFAULT 0 NOT NULL,
	"running_since" timestamp with time zone,
	"changed_by" text,
	CONSTRAINT "judging_singleton" CHECK ("judging_session"."id" = 'event'),
	CONSTRAINT "judging_timer_range" CHECK ("judging_session"."remaining_ms" between 0 and 300000)
);
--> statement-breakpoint
ALTER TABLE "judging_evaluations" ADD CONSTRAINT "judging_evaluations_presentation_id_judging_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."judging_presentations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_evaluations" ADD CONSTRAINT "judging_evaluations_judge_id_judging_judges_clerk_user_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judging_judges"("clerk_user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO judging_session(id) VALUES ('event');
--> statement-breakpoint
CREATE FUNCTION judging_board(actor_id text DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
 'session',(SELECT jsonb_build_object('initializedAt',s.initialized_at,'currentPresentationId',s.current_presentation_id,'revision',s.revision,
   'remainingMs',greatest(0,s.remaining_ms-CASE WHEN s.running_since IS NULL THEN 0 ELSE greatest(0,extract(epoch FROM (statement_timestamp()-s.running_since)))*1000 END),
   'running',s.running_since IS NOT NULL,'serverNow',statement_timestamp()) FROM judging_session s WHERE s.id='event'),
 'presentations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'project',p.snapshot->'project','members',p.snapshot->'members',
   'position',p.position,'status',p.status,'presentedAt',p.presented_at) ORDER BY p.position,p.id)
   FROM judging_presentations p WHERE actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM judging_evaluations e WHERE e.presentation_id=p.id AND e.judge_id=actor_id AND e.submitted_at IS NOT NULL)),'[]'::jsonb),
 'evaluations',coalesce((SELECT jsonb_agg(jsonb_build_object('presentationId',e.presentation_id,'judgeId',e.judge_id,'traction',e.traction,'technical',e.technical,'pitch',e.pitch,
   'notes',e.notes,'revision',e.revision,'submittedAt',e.submitted_at)) FROM judging_evaluations e WHERE (actor_id IS NULL OR e.judge_id=actor_id) AND (actor_id IS NULL OR e.submitted_at IS NULL)),'[]'::jsonb)
 ) || CASE WHEN actor_id IS NULL THEN jsonb_build_object('judges',coalesce((SELECT jsonb_agg(jsonb_build_object('clerkUserId',j.clerk_user_id,'name',j.name,'active',j.active) ORDER BY j.name) FROM judging_judges j),'[]'::jsonb)) ELSE '{}'::jsonb END
$$;
--> statement-breakpoint
CREATE FUNCTION judging_admin_action(admin_id text, command jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE s judging_session%ROWTYPE; operation text := command->>'action'; target_id uuid; failure_code text;
BEGIN
 PERFORM pg_advisory_xact_lock(721894012);
 IF nullif(admin_id,'') IS NULL THEN PERFORM hackathon_fail('ADMIN_REQUIRED','Se requiere acceso de administrador.'); END IF;
 SELECT * INTO s FROM judging_session WHERE id='event' FOR UPDATE;
 IF s.revision IS DISTINCT FROM (command->>'expectedRevision')::integer THEN PERFORM hackathon_fail('SESSION_CHANGED','La presentación cambió. Revisa el estado actual y vuelve a intentarlo.'); END IF;
 IF operation='initialize' THEN
  IF s.initialized_at IS NOT NULL THEN PERFORM hackathon_fail('ALREADY_INITIALIZED','Las entregas ya están congeladas.'); END IF;
  INSERT INTO judging_presentations(team_id,snapshot,position)
  SELECT t.id,jsonb_build_object('project',hackathon_project_view(t.id),'members',coalesce((SELECT jsonb_agg(coalesce(nullif(p.name,''),'Participante') ORDER BY p.name) FROM team_members m JOIN participants p ON p.id=m.participant_id WHERE m.team_id=t.id),'[]'::jsonb)),
   row_number() OVER (ORDER BY t.created_at,t.id)::integer FROM teams t JOIN project_submissions ps ON ps.team_id=t.id;
  IF NOT FOUND THEN PERFORM hackathon_fail('NO_PROJECTS','Todavía no hay proyectos enviados.'); END IF;
  UPDATE judging_session SET initialized_at=clock_timestamp() WHERE id='event';
 ELSIF operation='present' THEN
  target_id := (command->>'presentationId')::uuid;
  IF NOT EXISTS(SELECT 1 FROM judging_presentations WHERE id=target_id AND status='queued') THEN PERFORM hackathon_fail('NOT_QUEUED','Elige un equipo pendiente.'); END IF;
  UPDATE judging_presentations SET status='finished' WHERE id=s.current_presentation_id;
  UPDATE judging_presentations SET status='current',presented_at=clock_timestamp() WHERE id=target_id;
  UPDATE judging_session SET current_presentation_id=target_id,remaining_ms=300000,running_since=clock_timestamp() WHERE id='event';
 ELSIF operation='pause' THEN
  IF s.current_presentation_id IS NULL OR s.running_since IS NULL THEN PERFORM hackathon_fail('INVALID_PHASE','No hay un cronómetro en marcha.'); END IF;
  UPDATE judging_session SET remaining_ms=greatest(0,s.remaining_ms-floor(extract(epoch FROM (clock_timestamp()-s.running_since))*1000)::integer),running_since=NULL WHERE id='event';
 ELSIF operation='resume' THEN
  IF s.current_presentation_id IS NULL OR s.running_since IS NOT NULL OR s.remaining_ms<=0 THEN PERFORM hackathon_fail('INVALID_PHASE','No hay un cronómetro pausado.'); END IF;
  UPDATE judging_session SET running_since=clock_timestamp() WHERE id='event';
 ELSIF operation='finish' THEN
  IF s.current_presentation_id IS NULL THEN PERFORM hackathon_fail('INVALID_PHASE','No hay una presentación actual.'); END IF;
  UPDATE judging_presentations SET status='finished' WHERE id=s.current_presentation_id;
  UPDATE judging_session SET current_presentation_id=NULL,remaining_ms=0,running_since=NULL WHERE id='event';
 ELSIF operation IN ('skip','restore') THEN
  target_id := (command->>'presentationId')::uuid;
  UPDATE judging_presentations SET status=CASE WHEN operation='skip' THEN 'skipped' ELSE 'queued' END
   WHERE id=target_id AND status=CASE WHEN operation='skip' THEN 'queued' ELSE 'skipped' END;
  IF NOT FOUND THEN PERFORM hackathon_fail('INVALID_PHASE','El equipo ya cambió de estado.'); END IF;
 ELSIF operation='reorder' THEN
  IF jsonb_array_length(command->'presentationIds') <> (SELECT count(*) FROM judging_presentations WHERE status='queued')
   OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(command->'presentationIds')) <> jsonb_array_length(command->'presentationIds')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(command->'presentationIds') v WHERE NOT EXISTS(SELECT 1 FROM judging_presentations p WHERE p.id=v.value::uuid AND p.status='queued')) THEN
   PERFORM hackathon_fail('QUEUE_CHANGED','La lista de equipos pendientes cambió.');
  END IF;
  UPDATE judging_presentations p SET position=q.ordinality::integer FROM jsonb_array_elements_text(command->'presentationIds') WITH ORDINALITY q WHERE p.id=q.value::uuid;
 ELSIF operation='reopen' THEN
  UPDATE judging_evaluations SET submitted_at=NULL,revision=revision+1,reopened_by=admin_id,updated_at=clock_timestamp()
   WHERE presentation_id=(command->>'presentationId')::uuid AND judge_id=command->>'judgeId' AND submitted_at IS NOT NULL;
  IF NOT FOUND THEN PERFORM hackathon_fail('NOT_SUBMITTED','No hay una evaluación enviada para reabrir.'); END IF;
 ELSE PERFORM hackathon_fail('VALIDATION_ERROR','Operación desconocida.');
 END IF;
 UPDATE judging_session SET revision=revision+1,changed_by=admin_id WHERE id='event';
 RETURN judging_board();
EXCEPTION WHEN SQLSTATE 'P0001' THEN
 GET STACKED DIAGNOSTICS failure_code=PG_EXCEPTION_DETAIL;
 RETURN jsonb_build_object('error',jsonb_build_object('code',failure_code,'message',SQLERRM));
END
$$;
--> statement-breakpoint
CREATE FUNCTION judging_save_evaluation(actor_id text, command jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE e judging_evaluations%ROWTYPE; target_id uuid := (command->>'presentationId')::uuid; failure_code text; submitted timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(721894012);
 IF NOT EXISTS(SELECT 1 FROM judging_judges WHERE clerk_user_id=actor_id AND active) THEN PERFORM hackathon_fail('JUDGE_REQUIRED','Se requiere un jurado activo.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM judging_presentations WHERE id=target_id AND presented_at IS NOT NULL) THEN PERFORM hackathon_fail('NOT_PRESENTED','Este equipo todavía no ha presentado.'); END IF;
 INSERT INTO judging_evaluations(presentation_id,judge_id) VALUES(target_id,actor_id) ON CONFLICT DO NOTHING;
 SELECT * INTO e FROM judging_evaluations WHERE presentation_id=target_id AND judge_id=actor_id FOR UPDATE;
 IF e.submitted_at IS NOT NULL THEN PERFORM hackathon_fail('EVALUATION_LOCKED','La evaluación ya fue enviada.'); END IF;
 IF e.revision IS DISTINCT FROM (command->>'expectedRevision')::integer THEN PERFORM hackathon_fail('EVALUATION_CHANGED','La evaluación cambió en otra pestaña. Recarga para revisar la versión guardada.'); END IF;
 IF coalesce(length(command->>'notes'),0)>4000 OR EXISTS(SELECT 1 FROM unnest(ARRAY['traction','technical','pitch']) field WHERE command->>field IS NOT NULL AND (command->>field)::integer NOT BETWEEN 1 AND 5) THEN
  PERFORM hackathon_fail('VALIDATION_ERROR','Cada puntaje debe estar entre 1 y 5.');
 END IF;
 IF (command->>'submit')::boolean THEN
  IF command->>'traction' IS NULL OR command->>'technical' IS NULL OR command->>'pitch' IS NULL THEN PERFORM hackathon_fail('SCORES_REQUIRED','Completa los tres puntajes antes de enviar.'); END IF;
  submitted := clock_timestamp();
 END IF;
 UPDATE judging_evaluations SET traction=(command->>'traction')::integer,technical=(command->>'technical')::integer,pitch=(command->>'pitch')::integer,
  notes=coalesce(command->>'notes',''),submitted_at=submitted,revision=revision+1,updated_at=clock_timestamp() WHERE presentation_id=target_id AND judge_id=actor_id;
 RETURN judging_board(actor_id);
EXCEPTION WHEN SQLSTATE 'P0001' THEN
 GET STACKED DIAGNOSTICS failure_code=PG_EXCEPTION_DETAIL;
 RETURN jsonb_build_object('error',jsonb_build_object('code',failure_code,'message',SQLERRM));
END
$$;
