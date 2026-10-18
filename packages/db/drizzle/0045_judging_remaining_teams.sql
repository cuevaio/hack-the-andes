CREATE OR REPLACE FUNCTION judging_board(actor_id text DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE AS $$
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
   OR (actor_id IS NOT NULL AND p.presented_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM judging_evaluations e WHERE e.presentation_id=p.id AND e.judge_id=actor_id AND e.submitted_at IS NOT NULL))),'[]'::jsonb),
 'evaluations',coalesce((SELECT jsonb_agg(jsonb_build_object('presentationId',e.presentation_id,'judgeId',e.judge_id,'traction',e.traction,'technical',e.technical,'pitch',e.pitch,
   'notes',e.notes,'revision',e.revision,'submittedAt',e.submitted_at)) FROM judging_evaluations e WHERE (actor_id IS NULL AND e.presentation_id IN (SELECT id FROM judging_presentations WHERE status='current' OR id=(SELECT id FROM judging_presentations WHERE status='finished' ORDER BY presented_at DESC,id LIMIT 1)) OR actor_id IS NOT NULL AND e.judge_id=actor_id) AND (actor_id IS NULL OR e.submitted_at IS NULL)),'[]'::jsonb)
 ) || CASE WHEN actor_id IS NULL THEN jsonb_build_object('judges',coalesce((SELECT jsonb_agg(jsonb_build_object('clerkUserId',j.clerk_user_id,'name',j.name,'active',j.active) ORDER BY j.name) FROM judging_judges j),'[]'::jsonb)) ELSE '{}'::jsonb END
$$;
