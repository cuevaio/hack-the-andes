CREATE TABLE "project_submissions" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"deployment_url" text NOT NULL,
	"presentation_url" text NOT NULL,
	"description" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hackathon_settings" ADD COLUMN "gallery_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_submissions" ADD CONSTRAINT "project_submissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_author_id_participants_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE FUNCTION hackathon_project_view(project_team_id uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object('teamId',t.id,'teamName',t.name,'track',t.track,
 'submission',(SELECT jsonb_build_object('deploymentUrl',s.deployment_url,'presentationUrl',s.presentation_url,'description',s.description,'submittedAt',s.submitted_at,'updatedAt',s.updated_at) FROM project_submissions s WHERE s.team_id=t.id),
 'updates',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'authorName',u.author_name,'body',u.body,'createdAt',u.created_at) ORDER BY u.created_at,u.id) FROM project_updates u WHERE u.team_id=t.id),'[]'::jsonb)) FROM teams t WHERE t.id=project_team_id
$$;
--> statement-breakpoint
CREATE FUNCTION hackathon_project_state(actor_id uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object('project',(SELECT hackathon_project_view(m.team_id) FROM team_members m JOIN hackathon_confirmed_participants c ON c.participant_id=m.participant_id WHERE m.participant_id=actor_id))
$$;
--> statement-breakpoint
CREATE FUNCTION hackathon_project_gallery() RETURNS jsonb LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object('visible',coalesce((SELECT gallery_visible FROM hackathon_settings WHERE id='event'),false), 'projects', coalesce((SELECT jsonb_agg(hackathon_project_view(t.id) ORDER BY t.created_at) FROM teams t JOIN project_submissions s ON s.team_id=t.id WHERE (SELECT gallery_visible FROM hackathon_settings WHERE id='event')),'[]'::jsonb))
$$;
--> statement-breakpoint
CREATE FUNCTION hackathon_project_dashboard() RETURNS jsonb LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object('visible',coalesce((SELECT gallery_visible FROM hackathon_settings WHERE id='event'),false),'projects',coalesce((SELECT jsonb_agg(hackathon_project_view(t.id) ORDER BY t.created_at) FROM teams t),'[]'::jsonb))
$$;
--> statement-breakpoint
CREATE FUNCTION hackathon_project_action(actor_id uuid, command jsonb, admin_id text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE current_team uuid; actor_name text; operation text := command->>'action'; failure_code text;
BEGIN
 PERFORM pg_advisory_xact_lock(721894012);
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
 IF operation='update' THEN
  IF coalesce(length(trim(command->>'body')),0) NOT BETWEEN 1 AND 30000 THEN PERFORM hackathon_fail('VALIDATION_ERROR','La actualización debe tener entre 1 y 30000 caracteres.'); END IF;
  INSERT INTO project_updates(team_id,author_id,author_name,body) VALUES(current_team,actor_id,coalesce(nullif(actor_name,''),'Participante'),trim(command->>'body'));
 ELSIF operation='submit' THEN
  IF NOT command ? 'expectedUpdatedAt' THEN PERFORM hackathon_fail('VALIDATION_ERROR','Incluye la versión actual de la entrega.'); END IF;
  IF (SELECT s.updated_at FROM project_submissions s WHERE s.team_id=current_team) IS DISTINCT FROM (command->>'expectedUpdatedAt')::timestamptz THEN
   PERFORM hackathon_fail('PROJECT_CHANGED','Otro integrante actualizó la entrega. Ejecuta andes project y vuelve a enviar tus cambios.');
  END IF;
  IF coalesce(length(trim(command->>'description')),0) NOT BETWEEN 1 AND 30000 OR
    coalesce(length(command->>'deploymentUrl'),0) NOT BETWEEN 1 AND 2048 OR coalesce(command->>'deploymentUrl','') !~* '^https?://[^[:space:]/?#]+[^[:space:]]*$' OR
    coalesce(length(command->>'presentationUrl'),0) NOT BETWEEN 1 AND 2048 OR coalesce(command->>'presentationUrl','') !~* '^https?://[^[:space:]/?#]+[^[:space:]]*$'
   THEN PERFORM hackathon_fail('VALIDATION_ERROR','Incluye una descripción y URLs HTTP o HTTPS válidas para el despliegue y la presentación.'); END IF;
  INSERT INTO project_submissions(team_id,deployment_url,presentation_url,description) VALUES(current_team,command->>'deploymentUrl',command->>'presentationUrl',trim(command->>'description'))
   ON CONFLICT(team_id) DO UPDATE SET deployment_url=excluded.deployment_url,presentation_url=excluded.presentation_url,description=excluded.description,updated_at=clock_timestamp();
 ELSIF operation='rename' THEN
  IF coalesce(length(trim(command->>'name')),0) NOT BETWEEN 1 AND 80 OR command->>'name' ~ '[[:cntrl:]]' THEN PERFORM hackathon_fail('VALIDATION_ERROR','El nombre debe tener entre 1 y 80 caracteres.'); END IF;
  UPDATE teams SET name=trim(command->>'name') WHERE id=current_team;
 ELSE PERFORM hackathon_fail('VALIDATION_ERROR','Operación desconocida.');
 END IF;
 RETURN hackathon_project_state(actor_id);
EXCEPTION WHEN SQLSTATE 'P0001' THEN
 GET STACKED DIAGNOSTICS failure_code=PG_EXCEPTION_DETAIL;
 RETURN jsonb_build_object('error',jsonb_build_object('code',failure_code,'message',SQLERRM));
END
$$;
