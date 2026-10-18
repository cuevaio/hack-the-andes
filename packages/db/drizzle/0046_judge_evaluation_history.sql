CREATE FUNCTION judging_review_board(actor_id text) RETURNS jsonb LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
 'remainingTeams',(SELECT count(*) FROM judging_presentations WHERE status='queued'),
 'session',(SELECT jsonb_build_object('initializedAt',s.initialized_at,'currentPresentationId',s.current_presentation_id,'revision',s.revision,
   'remainingMs',greatest(0,s.remaining_ms-CASE WHEN s.running_since IS NULL THEN 0 ELSE greatest(0,extract(epoch FROM (statement_timestamp()-s.running_since)))*1000 END),
   'running',s.running_since IS NOT NULL,'serverNow',statement_timestamp()) FROM judging_session s WHERE s.id='event'),
 'presentations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'project',p.snapshot->'project','members',p.snapshot->'members',
   'position',p.position,'status',p.status,'presentedAt',p.presented_at) ORDER BY p.position,p.id)
   FROM judging_presentations p WHERE
   (actor_id IS NULL AND (p.status='current'
     OR p.id=(SELECT id FROM judging_presentations WHERE status='queued' ORDER BY position,id LIMIT 1)
     OR p.id=(SELECT id FROM judging_presentations WHERE status='finished' ORDER BY presented_at DESC,id LIMIT 1)))
   OR (actor_id IS NOT NULL AND p.presented_at IS NOT NULL)),'[]'::jsonb),
 'evaluations',coalesce((SELECT jsonb_agg(jsonb_build_object('presentationId',e.presentation_id,'judgeId',e.judge_id,'traction',e.traction,'technical',e.technical,'pitch',e.pitch,
   'notes',e.notes,'revision',e.revision,'submittedAt',e.submitted_at)) FROM judging_evaluations e WHERE (actor_id IS NULL AND e.presentation_id IN (SELECT id FROM judging_presentations WHERE status='current' OR id=(SELECT id FROM judging_presentations WHERE status='finished' ORDER BY presented_at DESC,id LIMIT 1)) OR actor_id IS NOT NULL AND e.judge_id=actor_id)),'[]'::jsonb)
 ) || CASE WHEN actor_id IS NULL THEN jsonb_build_object('judges',coalesce((SELECT jsonb_agg(jsonb_build_object('clerkUserId',j.clerk_user_id,'name',j.name,'active',j.active) ORDER BY j.name) FROM judging_judges j),'[]'::jsonb)) ELSE '{}'::jsonb END
$$;
--> statement-breakpoint
CREATE FUNCTION judging_save_review(actor_id text, command jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE e judging_evaluations%ROWTYPE; target_id uuid := (command->>'presentationId')::uuid; failure_code text; submitted timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(721894012);
 IF NOT EXISTS(SELECT 1 FROM judging_judges WHERE clerk_user_id=actor_id AND active) THEN PERFORM hackathon_fail('JUDGE_REQUIRED','Se requiere un jurado activo.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM judging_presentations WHERE id=target_id AND presented_at IS NOT NULL) THEN PERFORM hackathon_fail('NOT_PRESENTED','Este equipo todavía no ha presentado.'); END IF;
 INSERT INTO judging_evaluations(presentation_id,judge_id) VALUES(target_id,actor_id) ON CONFLICT DO NOTHING;
 SELECT * INTO e FROM judging_evaluations WHERE presentation_id=target_id AND judge_id=actor_id FOR UPDATE;
 IF e.submitted_at IS NOT NULL AND NOT coalesce((command->>'submit')::boolean,false) THEN PERFORM hackathon_fail('SUBMITTED_UPDATE_REQUIRED','Guarda los cambios con los tres puntajes completos para actualizar tu evaluación enviada.'); END IF;
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
 RETURN judging_review_board(actor_id);
EXCEPTION WHEN SQLSTATE 'P0001' THEN
 GET STACKED DIAGNOSTICS failure_code=PG_EXCEPTION_DETAIL;
 RETURN jsonb_build_object('error',jsonb_build_object('code',failure_code,'message',SQLERRM));
END
$$;
