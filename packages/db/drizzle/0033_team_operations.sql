-- Each command is a single database transaction, including on the HTTP driver.
-- Serialize the small (100-person) event's mutations so check-in/removal,
-- membership switches, settings and track claims cannot race each other.
INSERT INTO hackathon_settings (id) VALUES ('event');
--> statement-breakpoint
CREATE FUNCTION hackathon_delete_empty_team() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM teams t WHERE t.id=OLD.team_id AND NOT EXISTS (SELECT 1 FROM team_members m WHERE m.team_id=t.id);
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER team_members_delete_empty_team AFTER DELETE OR UPDATE OF team_id ON team_members
  FOR EACH ROW EXECUTE FUNCTION hackathon_delete_empty_team();
--> statement-breakpoint
-- A historical completed_at alone is not proof that today's required details
-- are complete. Keep this aligned with attendance confirmation requirements.
CREATE VIEW hackathon_confirmed_participants AS
  SELECT p.id AS participant_id, p.clerk_user_id, p.name, a.id AS application_id,
    coalesce(nullif(b.picture_url, ''), a.picture_url) AS picture_url, d.checked_in_at
  FROM participants p JOIN applications a ON a.participant_id=p.id AND a.status='accepted'
  JOIN acceptance_details d ON d.application_id=a.id
  LEFT JOIN participant_badges b ON b.application_id=a.id
  WHERE d.completed_at IS NOT NULL AND nullif(trim(p.legal_name), '') IS NOT NULL
    AND d.date_of_birth IS NOT NULL AND nullif(d.national_id_number, '') IS NOT NULL
    AND nullif(trim(d.emergency_contact_name), '') IS NOT NULL AND nullif(trim(d.emergency_contact_phone), '') IS NOT NULL
    AND nullif(coalesce(nullif(b.picture_url, ''), a.picture_url), '') IS NOT NULL
    AND a.participation_mode IS NOT NULL AND (a.participation_mode <> 'in_person' OR d.shirt_size IS NOT NULL);
--> statement-breakpoint
CREATE FUNCTION hackathon_team_view(team_id uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', t.id, 'name', t.name, 'track', t.track,
    'trackChangedBy', changer.name, 'trackChangedAt', t.track_changed_at,
    'members', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', p.id,
        'name', coalesce(nullif(p.name, ''), 'Participante'),
        'checkedIn', EXISTS (
          SELECT 1 FROM hackathon_confirmed_participants c WHERE c.participant_id=p.id AND c.checked_in_at IS NOT NULL
        )) ORDER BY m.slot)
      FROM team_members m JOIN participants p ON p.id=m.participant_id WHERE m.team_id=t.id
    ), '[]'::jsonb)
  ) FROM teams t LEFT JOIN participants changer ON changer.id=t.track_changed_by WHERE t.id=team_id
$$;
--> statement-breakpoint
CREATE FUNCTION hackathon_team_state(actor_id uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'participantId', actor_id,
    'checkedIn', EXISTS (SELECT 1 FROM hackathon_confirmed_participants c WHERE c.participant_id=actor_id AND c.checked_in_at IS NOT NULL),
    'selectionOpen', (SELECT selection_open FROM hackathon_settings WHERE id='event'),
    'team', (SELECT hackathon_team_view(m.team_id) FROM team_members m WHERE m.participant_id=actor_id),
    'invitations', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'teamId', i.team_id, 'teamName', t.name) ORDER BY i.created_at)
      FROM team_invitations i JOIN teams t ON t.id=i.team_id WHERE i.participant_id=actor_id), '[]'::jsonb),
    'tracks', (SELECT jsonb_agg(jsonb_build_object('id', track.id, 'teams', (SELECT count(*) FROM teams t WHERE t.track=track.id), 'capacity', 12))
      FROM (VALUES ('environmental'), ('security'), ('transport')) AS track(id))
  )
$$;
--> statement-breakpoint
CREATE FUNCTION hackathon_team_dashboard() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'selectionOpen', (SELECT selection_open FROM hackathon_settings WHERE id='event'),
    'teams', coalesce((SELECT jsonb_agg(hackathon_team_view(t.id) ORDER BY t.created_at) FROM teams t), '[]'::jsonb),
    'unassigned', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.participant_id,
      'name', coalesce(nullif(p.name, ''), 'Participante'), 'checkedIn', p.checked_in_at IS NOT NULL) ORDER BY p.name)
      FROM hackathon_confirmed_participants p
      WHERE NOT EXISTS (SELECT 1 FROM team_members m WHERE m.participant_id=p.participant_id)), '[]'::jsonb)
  )
$$;
--> statement-breakpoint
CREATE FUNCTION hackathon_fail(code text, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE=message, DETAIL=code;
END
$$;
--> statement-breakpoint
CREATE FUNCTION hackathon_action(actor_id uuid, command jsonb, admin_id text DEFAULT NULL) RETURNS jsonb
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
      UPDATE acceptance_details SET checked_in_at=clock_timestamp(), updated_at=clock_timestamp()
        WHERE acceptance_details.application_id=token_record.application_id;
      UPDATE checkin_tokens SET confirmed_by=admin_id WHERE checkin_tokens.application_id=token_record.application_id;
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
  IF operation IN ('accept', 'leave', 'remove', 'track') AND
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
      IF command->>'track' NOT IN ('environmental','security','transport') OR command->>'track' IS NULL THEN
        PERFORM hackathon_fail('VALIDATION_ERROR', 'Track inválido.');
      END IF;
      IF EXISTS (SELECT 1 FROM team_members m WHERE m.team_id=current_team AND NOT EXISTS (
        SELECT 1 FROM hackathon_confirmed_participants c WHERE c.participant_id=m.participant_id AND c.checked_in_at IS NOT NULL)) THEN
        PERFORM hackathon_fail('TEAM_CHECKIN_REQUIRED', 'Todos los integrantes deben tener check-in. Puedes retirar a quienes no llegaron con andes team remove.');
      END IF;
      SELECT * INTO destination FROM teams WHERE id=current_team;
      IF destination.track IS DISTINCT FROM command->>'track' THEN
        SELECT s INTO available_slot FROM generate_series(1,12) s WHERE NOT EXISTS
          (SELECT 1 FROM teams t WHERE t.track=command->>'track' AND t.track_slot=s) ORDER BY s LIMIT 1;
        IF available_slot IS NULL THEN PERFORM hackathon_fail('TRACK_FULL', 'Ese track ya tiene 12 equipos. Tu track anterior se mantiene.'); END IF;
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
