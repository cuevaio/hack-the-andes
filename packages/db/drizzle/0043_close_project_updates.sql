CREATE OR REPLACE FUNCTION hackathon_project_action(actor_id uuid, command jsonb, admin_id text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE current_team uuid; actor_name text; operation text := command->>'action'; failure_code text; saved_update project_updates%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(721894012);
 IF operation='submissions' THEN
  IF nullif(admin_id,'') IS NULL THEN PERFORM hackathon_fail('ADMIN_REQUIRED','Se requiere acceso de organización.'); END IF;
  IF jsonb_typeof(command->'submissionsOpen') IS DISTINCT FROM 'boolean' THEN PERFORM hackathon_fail('VALIDATION_ERROR','Estado de entregas inválido.'); END IF;
  UPDATE hackathon_settings SET submissions_open=(command->>'submissionsOpen')::boolean,changed_by=admin_id,changed_at=clock_timestamp() WHERE id='event';
  RETURN hackathon_project_dashboard();
 END IF;
 IF operation='visibility' THEN
  IF nullif(admin_id,'') IS NULL THEN PERFORM hackathon_fail('ADMIN_REQUIRED','Se requiere acceso de organización.'); END IF;
  IF jsonb_typeof(command->'galleryVisible') IS DISTINCT FROM 'boolean' THEN PERFORM hackathon_fail('VALIDATION_ERROR','Visibilidad inválida.'); END IF;
  UPDATE hackathon_settings SET gallery_visible=(command->>'galleryVisible')::boolean,changed_by=admin_id,changed_at=clock_timestamp() WHERE id='event';
  RETURN hackathon_project_dashboard();
 END IF;
 SELECT c.name INTO actor_name FROM hackathon_confirmed_participants c WHERE c.participant_id=actor_id;
 IF NOT FOUND THEN PERFORM hackathon_fail('CONFIRMATION_REQUIRED','Necesitas una postulación aceptada y asistencia confirmada.'); END IF;
 SELECT m.team_id INTO current_team FROM team_members m WHERE m.participant_id=actor_id;
 IF current_team IS NULL THEN PERFORM hackathon_fail('TEAM_REQUIRED','Primero crea un equipo o acepta una invitación.'); END IF;
 IF current_team IS DISTINCT FROM (command->>'expectedTeamId')::uuid THEN PERFORM hackathon_fail('TEAM_CHANGED','Tu equipo cambió. Ejecuta andes team y vuelve a confirmar.'); END IF;
 IF operation IN ('update','submit') AND NOT coalesce((SELECT submissions_open FROM hackathon_settings WHERE id='event'),true) THEN
  PERFORM hackathon_fail('SUBMISSIONS_CLOSED','Las entregas y actualizaciones de proyectos están cerradas. La organización debe reabrirlas para publicar cambios.');
 END IF;
 IF operation='update' THEN
  IF coalesce(length(trim(command->>'body')),0) NOT BETWEEN 1 AND 30000 THEN PERFORM hackathon_fail('VALIDATION_ERROR','La actualización debe tener entre 1 y 30000 caracteres.'); END IF;
  INSERT INTO project_updates(team_id,author_id,author_name,body) VALUES(current_team,actor_id,coalesce(nullif(actor_name,''),'Participante'),trim(command->>'body')) RETURNING * INTO saved_update;
  RETURN jsonb_build_object('teamId',current_team,'teamName',(SELECT name FROM teams WHERE id=current_team),
   'update',jsonb_build_object('id',saved_update.id,'authorName',saved_update.author_name,'body',saved_update.body,'createdAt',saved_update.created_at),
   'updateCount',(SELECT count(*) FROM project_updates WHERE team_id=current_team));
 ELSIF operation='submit' THEN
  IF NOT command ? 'expectedUpdatedAt' THEN PERFORM hackathon_fail('VALIDATION_ERROR','Incluye la versión actual de la entrega.'); END IF;
  IF (SELECT s.updated_at FROM project_submissions s WHERE s.team_id=current_team) IS DISTINCT FROM (command->>'expectedUpdatedAt')::timestamptz THEN
   PERFORM hackathon_fail('PROJECT_CHANGED','Otro integrante actualizó la entrega. Ejecuta andes project y vuelve a enviar tus cambios.');
  END IF;
  IF coalesce(length(trim(command->>'description')),0) NOT BETWEEN 1 AND 30000 OR
    coalesce(length(command->>'deploymentUrl'),0) NOT BETWEEN 1 AND 2048 OR coalesce(command->>'deploymentUrl','') !~* '^https?://[^[:space:]/?#]+[^[:space:]]*$' OR
    coalesce(length(command->>'presentationUrl'),0) NOT BETWEEN 1 AND 2048 OR coalesce(command->>'presentationUrl','') !~* '^https?://[^[:space:]/?#]+[^[:space:]]*$'
   THEN PERFORM hackathon_fail('VALIDATION_ERROR','Incluye una descripción y URLs HTTP o HTTPS válidas para el despliegue y la presentación.'); END IF;
  IF coalesce(length(command->>'githubUrl'),0) NOT BETWEEN 1 AND 2048 OR
    coalesce(command->>'githubUrl','') !~ '^https://github[.]com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$' OR
    split_part(command->>'githubUrl','/',4) IN ('.','..') OR split_part(command->>'githubUrl','/',5) IN ('.','..')
   THEN PERFORM hackathon_fail('VALIDATION_ERROR','Incluye la URL del repositorio: https://github.com/organizacion/repositorio.'); END IF;
  INSERT INTO project_submissions(team_id,deployment_url,presentation_url,github_url,description) VALUES(current_team,command->>'deploymentUrl',command->>'presentationUrl',command->>'githubUrl',trim(command->>'description'))
   ON CONFLICT(team_id) DO UPDATE SET deployment_url=excluded.deployment_url,presentation_url=excluded.presentation_url,github_url=excluded.github_url,description=excluded.description,updated_at=clock_timestamp();
 ELSE PERFORM hackathon_fail('VALIDATION_ERROR','Operación desconocida.');
 END IF;
 RETURN hackathon_project_summary_state(actor_id);
EXCEPTION WHEN SQLSTATE 'P0001' THEN
 GET STACKED DIAGNOSTICS failure_code=PG_EXCEPTION_DETAIL;
 RETURN jsonb_build_object('error',jsonb_build_object('code',failure_code,'message',SQLERRM));
END
$$;
