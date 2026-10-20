CREATE TABLE "participation_certificates" (
	"id" varchar(41) PRIMARY KEY DEFAULT 'HTA-2026-' || upper(replace(gen_random_uuid()::text, '-', '')) NOT NULL,
	"application_id" uuid NOT NULL,
	"recipient_name" varchar(200) NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "participation_certificates_name_required" CHECK (length(btrim("participation_certificates"."recipient_name")) > 0),
	CONSTRAINT "participation_certificates_id_format" CHECK ("participation_certificates"."id" ~ '^HTA-2026-[A-F0-9]{32}$')
);
--> statement-breakpoint
ALTER TABLE "participation_certificates" ADD CONSTRAINT "participation_certificates_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "participation_certificates_application_unique" ON "participation_certificates" USING btree ("application_id");
--> statement-breakpoint
CREATE FUNCTION hackathon_certificate_result(certificate_id text) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('id', c.id, 'recipientName', c.recipient_name,
    'issuedAt', c.issued_at,
    'status', CASE WHEN c.revoked_at IS NULL AND a.status = 'accepted' AND d.checked_in_at IS NOT NULL
      THEN 'valid' ELSE 'revoked' END)
  FROM participation_certificates c
  JOIN applications a ON a.id = c.application_id
  LEFT JOIN acceptance_details d ON d.application_id = a.id
  WHERE c.id = certificate_id
$$;
--> statement-breakpoint
CREATE FUNCTION hackathon_guard_certificate_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM applications a JOIN acceptance_details d ON d.application_id = a.id
    WHERE a.id = NEW.application_id AND a.status = 'accepted' AND d.checked_in_at IS NOT NULL
    FOR SHARE OF a, d;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Certificates require an accepted application with recorded check-in' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER participation_certificate_attendance_guard BEFORE INSERT ON participation_certificates
  FOR EACH ROW EXECUTE FUNCTION hackathon_guard_certificate_attendance();
--> statement-breakpoint
CREATE FUNCTION hackathon_issue_certificate(clerk_id text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  application_uuid uuid;
  recipient text;
  certificate_id text;
BEGIN
  SELECT a.id, nullif(btrim(p.name), '') INTO application_uuid, recipient
    FROM participants p JOIN applications a ON a.participant_id = p.id
    JOIN acceptance_details d ON d.application_id = a.id
    WHERE p.clerk_user_id = clerk_id AND a.status = 'accepted' AND d.checked_in_at IS NOT NULL
    FOR UPDATE OF a, d;
  IF application_uuid IS NULL THEN
    RETURN jsonb_build_object('error', jsonb_build_object('code', 'CERTIFICATE_NOT_ELIGIBLE',
      'message', 'Tu certificado estará disponible cuando la organización registre tu check-in presencial.'));
  END IF;
  SELECT id INTO certificate_id FROM participation_certificates WHERE application_id = application_uuid;
  IF certificate_id IS NOT NULL THEN RETURN hackathon_certificate_result(certificate_id); END IF;
  IF recipient IS NULL THEN
    RETURN jsonb_build_object('error', jsonb_build_object('code', 'CERTIFICATE_NAME_REQUIRED',
      'message', 'Configura tu nombre público en tu carnet antes de emitir el certificado.'));
  END IF;
  INSERT INTO participation_certificates(application_id, recipient_name) VALUES(application_uuid, recipient)
    RETURNING id INTO certificate_id;
  RETURN hackathon_certificate_result(certificate_id);
END $$;
