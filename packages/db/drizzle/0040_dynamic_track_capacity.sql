-- Track allocation is based on current teams. Existing selections survive a
-- capacity reduction. hackathon_action serializes mutations before this check.
CREATE FUNCTION hackathon_track_capacity() RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT ceil(count(*) / 4.0)::integer FROM teams
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hackathon_team_state(actor_id uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'participantId', actor_id,
    'checkedIn', EXISTS (SELECT 1 FROM hackathon_confirmed_participants c WHERE c.participant_id=actor_id AND c.checked_in_at IS NOT NULL),
    'selectionOpen', (SELECT selection_open FROM hackathon_settings WHERE id='event'),
    'team', (SELECT hackathon_team_view(m.team_id) FROM team_members m WHERE m.participant_id=actor_id),
    'invitations', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'teamId', i.team_id, 'teamName', t.name) ORDER BY i.created_at)
      FROM team_invitations i JOIN teams t ON t.id=i.team_id WHERE i.participant_id=actor_id), '[]'::jsonb),
    'tracks', (SELECT jsonb_agg(jsonb_build_object('id', track.id, 'teams', (SELECT count(*) FROM teams t WHERE t.track=track.id), 'capacity', hackathon_track_capacity()))
      FROM (VALUES ('environmental'), ('transport'), ('education'), ('security')) AS track(id))
  )
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hackathon_action(actor_id uuid, command jsonb, admin_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  operation text := command->>'action';
  actor_application uuid;
  current_team uuid;
  target_team uuid;
  target_participant uuid;
  available_slot integer;
  destination teams%ROWTYPE;
  token_record record;
  failure_code text;
  arrival_result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(721894012);

  IF operation IN ('settings', 'checkin-preview', 'checkin-confirm') THEN
    IF admin_id IS NULL OR admin_id='' THEN
      PERFORM hackathon_fail('ADMIN_REQUIRED', 'Se requiere acceso de organización.');
    END IF;
    IF operation='settings' THEN
      UPDATE hackathon_settings SET selection_open=(command->>'selectionOpen')::boolean,
        changed_by=admin_id, changed_at=clock_timestamp() WHERE id='event';
      RETURN hackathon_team_dashboard();
    END IF;
    SELECT c.application_id, eligible.participant_id, coalesce(nullif(eligible.name, ''), 'Participante') AS name,
      eligible.picture_url, eligible.checked_in_at, c.expires_at
      INTO token_record
      FROM checkin_tokens c JOIN hackathon_confirmed_participants eligible ON eligible.application_id=c.application_id
      WHERE c.token_hash=command->>'tokenHash';
    IF NOT FOUND OR token_record.expires_at <= clock_timestamp() THEN
      PERFORM hackathon_fail('CHECKIN_TOKEN_EXPIRED', 'Código inválido o vencido. Pide que ejecuten andes checkin otra vez.');
    END IF;
    IF operation='checkin-confirm' AND token_record.checked_in_at IS NULL THEN
      arrival_result := hackathon_confirm_arrival(token_record.application_id,admin_id);
      IF arrival_result ? 'error' THEN RETURN arrival_result; END IF;
    END IF;
    RETURN jsonb_build_object('name', token_record.name, 'pictureUrl', token_record.picture_url,
      'checkedIn', operation='checkin-confirm' OR token_record.checked_in_at IS NOT NULL);
  END IF;

  SELECT c.application_id INTO actor_application FROM hackathon_confirmed_participants c WHERE c.participant_id=actor_id;
  IF actor_application IS NULL THEN
    PERFORM hackathon_fail('CONFIRMATION_REQUIRED', 'Necesitas una postulación aceptada y confirmar tu asistencia con andes confirm.');
  END IF;
  IF operation='checkin' THEN
    IF EXISTS (SELECT 1 FROM acceptance_details d WHERE d.application_id=actor_application AND d.checked_in_at IS NOT NULL) THEN
      RETURN jsonb_build_object('checkedIn', true);
    END IF;
    INSERT INTO checkin_tokens (application_id, token_hash, expires_at)
      VALUES (actor_application, command->>'tokenHash', clock_timestamp()+interval '5 minutes')
      ON CONFLICT ON CONSTRAINT checkin_tokens_pkey DO UPDATE SET token_hash=excluded.token_hash,
        expires_at=excluded.expires_at, confirmed_by=NULL;
    RETURN jsonb_build_object('checkedIn', false, 'expiresAt',
      (SELECT c.expires_at FROM checkin_tokens c WHERE c.application_id=actor_application));
  END IF;

  SELECT m.team_id INTO current_team FROM team_members m WHERE m.participant_id=actor_id;
  IF operation IN ('accept', 'leave', 'remove', 'track', 'rename') AND
      current_team IS DISTINCT FROM (command->>'expectedTeamId')::uuid THEN
    PERFORM hackathon_fail('TEAM_CHANGED', 'Tu equipo cambió. Ejecuta andes team y vuelve a confirmar la operación.');
  END IF;

  IF operation='create' THEN
    IF current_team IS NOT NULL THEN
      PERFORM hackathon_fail('ALREADY_IN_TEAM', 'Ya tienes equipo. Puedes salir o aceptar una invitación para cambiar.');
    END IF;
    IF (SELECT count(*) FROM teams) >= 36 THEN
      PERFORM hackathon_fail('TEAMS_FULL', 'Ya hay 36 equipos. Únete a uno existente.');
    END IF;
    IF length(trim(command->>'name')) NOT BETWEEN 1 AND 80 THEN
      PERFORM hackathon_fail('VALIDATION_ERROR', 'El nombre debe tener entre 1 y 80 caracteres.');
    END IF;
    INSERT INTO teams (name) VALUES (trim(command->>'name')) RETURNING id INTO target_team;
    INSERT INTO team_members VALUES (actor_id, target_team, 1);

  ELSIF operation='accept' THEN
    SELECT i.team_id INTO target_team FROM team_invitations i
      WHERE i.id=(command->>'invitationId')::uuid AND i.participant_id=actor_id;
    IF target_team IS NULL THEN
      PERFORM hackathon_fail('INVITATION_NOT_FOUND', 'La invitación ya no está disponible.');
    END IF;
    SELECT * INTO destination FROM teams WHERE id=target_team;
    SELECT s INTO available_slot FROM generate_series(1,4) s WHERE NOT EXISTS
      (SELECT 1 FROM team_members m WHERE m.team_id=target_team AND m.slot=s) ORDER BY s LIMIT 1;
    IF available_slot IS NULL THEN
      PERFORM hackathon_fail('TEAM_FULL', 'Ese equipo ya tiene cuatro integrantes. Sigues en tu equipo actual.');
    END IF;
    IF destination.track IS NOT NULL AND NOT EXISTS (SELECT 1 FROM acceptance_details d
        WHERE d.application_id=actor_application AND d.checked_in_at IS NOT NULL) THEN
      PERFORM hackathon_fail('CHECKIN_REQUIRED', 'Necesitas check-in para unirte a un equipo que ya eligió track.');
    END IF;
    DELETE FROM team_members WHERE participant_id=actor_id;
    INSERT INTO team_members VALUES (actor_id, target_team, available_slot);
    DELETE FROM team_invitations WHERE team_id=target_team AND participant_id=actor_id;

  ELSIF operation='decline' THEN
    DELETE FROM team_invitations WHERE id=(command->>'invitationId')::uuid AND participant_id=actor_id;
    IF NOT FOUND THEN PERFORM hackathon_fail('INVITATION_NOT_FOUND', 'La invitación ya no está disponible.'); END IF;

  ELSE
    IF current_team IS NULL THEN PERFORM hackathon_fail('TEAM_REQUIRED', 'Primero crea un equipo o acepta una invitación.'); END IF;
    IF operation='leave' THEN
      DELETE FROM team_members WHERE participant_id=actor_id;

    ELSIF operation='rename' THEN
      IF coalesce(length(trim(command->>'name')),0) NOT BETWEEN 1 AND 80 OR command->>'name' ~ '[[:cntrl:]]' THEN
        PERFORM hackathon_fail('VALIDATION_ERROR', 'El nombre debe tener entre 1 y 80 caracteres.');
      END IF;
      UPDATE teams SET name=trim(command->>'name') WHERE id=current_team;

    ELSIF operation='invite' THEN
      target_participant := (command->>'inviteeId')::uuid;
      IF NOT EXISTS (SELECT 1 FROM hackathon_confirmed_participants c WHERE c.participant_id=target_participant) THEN
        PERFORM hackathon_fail('INVITEE_NOT_ELIGIBLE', 'Ese correo debe pertenecer a un participante aceptado con asistencia confirmada.');
      END IF;
      IF EXISTS (SELECT 1 FROM team_members m WHERE m.team_id=current_team AND m.participant_id=target_participant) THEN
        PERFORM hackathon_fail('ALREADY_IN_TEAM', 'Esa persona ya está en tu equipo.');
      END IF;
      IF (SELECT count(*) FROM team_members WHERE team_id=current_team) >= 4 THEN
        PERFORM hackathon_fail('TEAM_FULL', 'Tu equipo ya tiene cuatro integrantes.');
      END IF;
      INSERT INTO team_invitations (team_id,participant_id) VALUES (current_team,target_participant)
        ON CONFLICT (team_id,participant_id) DO NOTHING;

    ELSIF operation='remove' THEN
      target_participant := (command->>'participantId')::uuid;
      IF target_participant=actor_id THEN PERFORM hackathon_fail('USE_TEAM_LEAVE', 'Para salir, usa andes team leave.'); END IF;
      IF NOT EXISTS (SELECT 1 FROM acceptance_details d WHERE d.application_id=actor_application AND d.checked_in_at IS NOT NULL) THEN
        PERFORM hackathon_fail('CHECKIN_REQUIRED', 'Solo integrantes con check-in pueden retirar a una persona ausente.');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM team_members m WHERE m.team_id=current_team AND m.participant_id=target_participant) THEN
        PERFORM hackathon_fail('MEMBER_NOT_FOUND', 'Esa persona ya no está en tu equipo.');
      END IF;
      IF EXISTS (SELECT 1 FROM applications a JOIN acceptance_details d ON d.application_id=a.id
        WHERE a.participant_id=target_participant AND a.status='accepted' AND d.checked_in_at IS NOT NULL) THEN
        PERFORM hackathon_fail('MEMBER_CHECKED_IN', 'No puedes retirar a una persona que ya tiene check-in. Debe salir voluntariamente.');
      END IF;
      DELETE FROM team_members WHERE participant_id=target_participant AND team_id=current_team;

    ELSIF operation='track' THEN
      IF NOT (SELECT selection_open FROM hackathon_settings WHERE id='event') THEN
        PERFORM hackathon_fail('TRACK_SELECTION_CLOSED', 'La selección de tracks está cerrada. La organización anunciará su apertura.');
      END IF;
      IF command->>'track' NOT IN ('environmental','transport','education','security') OR command->>'track' IS NULL THEN
        PERFORM hackathon_fail('VALIDATION_ERROR', 'Track inválido.');
      END IF;
      IF EXISTS (SELECT 1 FROM team_members m WHERE m.team_id=current_team AND NOT EXISTS (
        SELECT 1 FROM hackathon_confirmed_participants c WHERE c.participant_id=m.participant_id AND c.checked_in_at IS NOT NULL)) THEN
        PERFORM hackathon_fail('TEAM_CHECKIN_REQUIRED', 'Todos los integrantes deben tener check-in. Puedes retirar a quienes no llegaron con andes team remove.');
      END IF;
      SELECT * INTO destination FROM teams WHERE id=current_team;
      IF destination.track IS DISTINCT FROM command->>'track' THEN
        IF (SELECT count(*) FROM teams WHERE track=command->>'track') >= hackathon_track_capacity() THEN
          PERFORM hackathon_fail('TRACK_FULL', 'Ese track alcanzó el 25% del total de equipos, redondeado hacia arriba. Tu track anterior se mantiene.');
        END IF;
        SELECT s INTO available_slot FROM generate_series(1,12) s WHERE NOT EXISTS
          (SELECT 1 FROM teams t WHERE t.track=command->>'track' AND t.track_slot=s) ORDER BY s LIMIT 1;
        IF available_slot IS NULL THEN PERFORM hackathon_fail('TRACK_FULL', 'Ese track no tiene cupos disponibles. Tu track anterior se mantiene.'); END IF;
        UPDATE teams SET track=command->>'track', track_slot=available_slot,
          track_changed_by=actor_id, track_changed_at=clock_timestamp() WHERE id=current_team;
      END IF;
    ELSE
      PERFORM hackathon_fail('VALIDATION_ERROR', 'Operación desconocida.');
    END IF;
  END IF;
  RETURN hackathon_team_state(actor_id);
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  GET STACKED DIAGNOSTICS failure_code=PG_EXCEPTION_DETAIL;
  RETURN jsonb_build_object('error', jsonb_build_object('code', failure_code, 'message', SQLERRM));
END
$$;
