ALTER TABLE "acceptance_details" ADD COLUMN "checkin_exception_reason" text;--> statement-breakpoint
ALTER TABLE "acceptance_details" ADD CONSTRAINT "acceptance_details_checkin_exception_audited" CHECK ("acceptance_details"."checkin_exception_reason" is null or (
        length(trim("acceptance_details"."checkin_exception_reason")) > 0 and
        "acceptance_details"."checked_in_at" is not null and
        length(trim("acceptance_details"."checked_in_by")) > 0 and
        "acceptance_details"."checked_in_by" is not null
      ));--> statement-breakpoint
-- Organization may record an observed arrival without inventing confirmation
-- details. This exception grants credits only, not confirmed-team eligibility.
CREATE FUNCTION hackathon_confirm_arrival_exception(target_application uuid, verifying_admin text, exception_reason text) RETURNS timestamptz
LANGUAGE plpgsql AS $$
DECLARE arrival_time timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(721894012);
  IF nullif(trim(verifying_admin),'') IS NULL THEN
    PERFORM hackathon_fail('ADMIN_REQUIRED','Se requiere acceso de organización.');
  END IF;
  IF nullif(trim(exception_reason),'') IS NULL THEN
    PERFORM hackathon_fail('VALIDATION_ERROR','Indica el motivo de la excepción de check-in.');
  END IF;
  PERFORM 1 FROM applications WHERE id=target_application AND status='accepted' FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM hackathon_fail('CHECKIN_ELIGIBILITY_CHANGED','La persona debe tener una inscripción aceptada.');
  END IF;
  INSERT INTO acceptance_details(application_id,checked_in_at,checked_in_by,checkin_exception_reason)
    VALUES(target_application,clock_timestamp(),verifying_admin,trim(exception_reason))
    ON CONFLICT(application_id) DO UPDATE SET
      checked_in_at=coalesce(acceptance_details.checked_in_at,excluded.checked_in_at),
      checked_in_by=CASE WHEN acceptance_details.checked_in_at IS NULL THEN excluded.checked_in_by ELSE acceptance_details.checked_in_by END,
      checkin_exception_reason=CASE WHEN acceptance_details.checked_in_at IS NULL THEN excluded.checkin_exception_reason ELSE acceptance_details.checkin_exception_reason END,
      updated_at=CASE WHEN acceptance_details.checked_in_at IS NULL THEN clock_timestamp() ELSE acceptance_details.updated_at END
    RETURNING checked_in_at INTO arrival_time;
  RETURN arrival_time;
END
$$;
