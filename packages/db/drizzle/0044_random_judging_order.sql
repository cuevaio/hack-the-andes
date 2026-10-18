CREATE OR REPLACE FUNCTION judging_board(actor_id text DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
 'session',(SELECT jsonb_build_object('initializedAt',s.initialized_at,'currentPresentationId',s.current_presentation_id,'revision',s.revision,
   'remainingMs',greatest(0,s.remaining_ms-CASE WHEN s.running_since IS NULL THEN 0 ELSE greatest(0,extract(epoch FROM (statement_timestamp()-s.running_since)))*1000 END),
   'running',s.running_since IS NOT NULL,'serverNow',statement_timestamp()) FROM judging_session s WHERE s.id='event'),
 'presentations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'project',p.snapshot->'project','members',p.snapshot->'members',
   'position',p.position,'status',p.status,'presentedAt',p.presented_at) ORDER BY p.position,p.id)
   FROM judging_presentations p WHERE
   (actor_id IS NULL AND (p.status='current'
     OR p.id=(SELECT id FROM judging_presentations WHERE status='queued' ORDER BY position,id LIMIT 1)
     OR p.id=(SELECT id FROM judging_presentations WHERE status='finished' ORDER BY presented_at DESC,id LIMIT 1)))
   OR (actor_id IS NOT NULL AND p.presented_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM judging_evaluations e WHERE e.presentation_id=p.id AND e.judge_id=actor_id AND e.submitted_at IS NOT NULL))),'[]'::jsonb),
 'evaluations',coalesce((SELECT jsonb_agg(jsonb_build_object('presentationId',e.presentation_id,'judgeId',e.judge_id,'traction',e.traction,'technical',e.technical,'pitch',e.pitch,
   'notes',e.notes,'revision',e.revision,'submittedAt',e.submitted_at)) FROM judging_evaluations e WHERE (actor_id IS NULL AND e.presentation_id IN (SELECT id FROM judging_presentations WHERE status='current' OR id=(SELECT id FROM judging_presentations WHERE status='finished' ORDER BY presented_at DESC,id LIMIT 1)) OR actor_id IS NOT NULL AND e.judge_id=actor_id) AND (actor_id IS NULL OR e.submitted_at IS NULL)),'[]'::jsonb)
 ) || CASE WHEN actor_id IS NULL THEN jsonb_build_object('judges',coalesce((SELECT jsonb_agg(jsonb_build_object('clerkUserId',j.clerk_user_id,'name',j.name,'active',j.active) ORDER BY j.name) FROM judging_judges j),'[]'::jsonb)) ELSE '{}'::jsonb END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION judging_admin_action(admin_id text, command jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE s judging_session%ROWTYPE; operation text := command->>'action'; target_id uuid; failure_code text;
BEGIN
 PERFORM pg_advisory_xact_lock(721894012);
 IF nullif(admin_id,'') IS NULL THEN PERFORM hackathon_fail('ADMIN_REQUIRED','Se requiere acceso de administrador.'); END IF;
 SELECT * INTO s FROM judging_session WHERE id='event' FOR UPDATE;
 IF s.revision IS DISTINCT FROM (command->>'expectedRevision')::integer THEN PERFORM hackathon_fail('SESSION_CHANGED','La presentación cambió. Revisa el estado actual y vuelve a intentarlo.'); END IF;
 IF operation IN ('reorder','skip','restore') THEN PERFORM hackathon_fail('RANDOM_ORDER','El orden es aleatorio y no se puede modificar.'); END IF;
 IF operation='initialize' THEN
  IF s.initialized_at IS NOT NULL THEN PERFORM hackathon_fail('ALREADY_INITIALIZED','Las entregas ya están congeladas.'); END IF;
  INSERT INTO judging_presentations(team_id,snapshot,position)
  SELECT t.id,jsonb_build_object('project',hackathon_project_view(t.id),'members',coalesce((SELECT jsonb_agg(coalesce(nullif(p.name,''),'Participante') ORDER BY p.name) FROM team_members m JOIN participants p ON p.id=m.participant_id WHERE m.team_id=t.id),'[]'::jsonb)),
   row_number() OVER (ORDER BY random())::integer FROM teams t JOIN project_submissions ps ON ps.team_id=t.id;
  IF NOT FOUND THEN PERFORM hackathon_fail('NO_PROJECTS','Todavía no hay proyectos enviados.'); END IF;
  UPDATE judging_session SET initialized_at=clock_timestamp() WHERE id='event';
 ELSIF operation='present' THEN
  target_id := (command->>'presentationId')::uuid;
  IF target_id IS DISTINCT FROM (SELECT id FROM judging_presentations WHERE status='queued' ORDER BY position,id LIMIT 1) THEN PERFORM hackathon_fail('NEXT_TEAM_REQUIRED','Solo se puede iniciar el siguiente equipo.'); END IF;
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
-- Shuffle the remaining queue once when adopting random presentation order.
-- Keep the current presentation, completed teams, and evaluations intact.
SELECT pg_advisory_xact_lock(721894012);
--> statement-breakpoint
WITH shuffled AS (
 SELECT id,row_number() OVER (ORDER BY random())::integer AS position
 FROM judging_presentations WHERE status='queued'
)
UPDATE judging_presentations p SET position=s.position FROM shuffled s WHERE p.id=s.id;
--> statement-breakpoint
UPDATE judging_session SET revision=revision+1 WHERE id='event' AND initialized_at IS NOT NULL;
