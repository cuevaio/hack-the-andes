CREATE OR REPLACE FUNCTION "complete_challenge_evaluation"(
	p_reservation_id uuid,
	p_attempt_id uuid,
	p_solution_kind text,
	p_solution jsonb,
	p_accuracy double precision,
	p_exact_count integer,
	p_sample_size integer,
	p_mean_error double precision,
	p_queries_used integer,
	p_runtime_ms integer,
	p_execution_cost integer
) RETURNS TABLE (
	share_code varchar,
	evaluations_used integer,
	evaluations_limit integer
) AS $$
DECLARE
	reserved_attempt_id uuid;
	selected_best_evaluation_id uuid;
BEGIN
	-- Serialize completions before checking for an already persisted submission.
	PERFORM 1 FROM "challenge_attempts" WHERE "id" = p_attempt_id FOR UPDATE;

	DELETE FROM "challenge_reservations"
	WHERE
		"id" = p_reservation_id
		AND "attempt_id" = p_attempt_id
		AND "kind" = 'evaluation'
	RETURNING "attempt_id" INTO reserved_attempt_id;

	IF reserved_attempt_id IS NULL THEN
		RETURN;
	END IF;

	IF p_solution->>'challengeSlug' = 'make-it-fast'
		AND p_solution ? 'review'
		AND EXISTS (
			SELECT 1 FROM "challenge_evaluations" AS evaluation
			WHERE evaluation."attempt_id" = reserved_attempt_id
				AND evaluation."solution"->>'source' = p_solution->>'source'
				AND evaluation."solution"->'review' = p_solution->'review'
		) THEN
		RETURN QUERY
		UPDATE "challenge_attempts" AS attempt
		SET "evaluations_pending" = GREATEST(attempt."evaluations_pending" - 1, 0),
			"updated_at" = now()
		WHERE attempt."id" = reserved_attempt_id
		RETURNING attempt."share_code", attempt."evaluations_used", attempt."evaluations_limit";
		RETURN;
	END IF;

	INSERT INTO "challenge_evaluations" (
		"attempt_id",
		"solution_kind",
		"solution",
		"accuracy",
		"exact_count",
		"sample_size",
		"mean_error",
		"queries_used",
		"runtime_ms",
		"execution_cost"
	) VALUES (
		reserved_attempt_id,
		p_solution_kind,
		p_solution,
		p_accuracy,
		p_exact_count,
		p_sample_size,
		p_mean_error,
		p_queries_used,
		p_runtime_ms,
		p_execution_cost
	);

	SELECT best."evaluation_id"
	INTO selected_best_evaluation_id
	FROM "challenge_best_evaluations" AS best
	WHERE best."attempt_id" = reserved_attempt_id;

	RETURN QUERY
	UPDATE "challenge_attempts" AS attempt
	SET
		"evaluations_pending" = GREATEST(attempt."evaluations_pending" - 1, 0),
		"evaluations_used" = attempt."evaluations_used" + 1,
		"best_evaluation_id" = selected_best_evaluation_id,
		"updated_at" = now()
	WHERE attempt."id" = reserved_attempt_id
	RETURNING
		attempt."share_code",
		attempt."evaluations_used",
		attempt."evaluations_limit";
END;
$$ LANGUAGE plpgsql;
