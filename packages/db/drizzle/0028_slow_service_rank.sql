-- Custom SQL migration file, put your code below! --
CREATE OR REPLACE FUNCTION "upsert_challenge_best_evaluation"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "challenge_best_evaluations" (
    "attempt_id", "evaluation_id", "accuracy", "exact_count", "queries_used",
    "runtime_ms", "execution_cost", "evaluated_at"
  ) VALUES (
    NEW."attempt_id", NEW."id", NEW."accuracy", NEW."exact_count", NEW."queries_used",
    NEW."runtime_ms", NEW."execution_cost", NEW."created_at"
  )
  ON CONFLICT ("attempt_id") DO UPDATE
  SET (
    "evaluation_id", "accuracy", "exact_count", "queries_used", "runtime_ms",
    "execution_cost", "evaluated_at"
  ) = (
    SELECT
      candidate."evaluation_id", candidate."accuracy", candidate."exact_count",
      candidate."queries_used", candidate."runtime_ms", candidate."execution_cost",
      candidate."evaluated_at"
    FROM (
      VALUES
        (excluded."evaluation_id", excluded."accuracy", excluded."exact_count",
         excluded."queries_used", excluded."runtime_ms", excluded."execution_cost", excluded."evaluated_at"),
        ("challenge_best_evaluations"."evaluation_id", "challenge_best_evaluations"."accuracy",
         "challenge_best_evaluations"."exact_count", "challenge_best_evaluations"."queries_used",
         "challenge_best_evaluations"."runtime_ms", "challenge_best_evaluations"."execution_cost",
         "challenge_best_evaluations"."evaluated_at")
    ) AS candidate(
      "evaluation_id", "accuracy", "exact_count", "queries_used", "runtime_ms", "execution_cost", "evaluated_at"
    )
    ORDER BY
      candidate."accuracy" DESC,
      candidate."exact_count" DESC,
      candidate."queries_used" ASC,
      CASE
        WHEN (SELECT "challenge_slug" FROM "challenge_attempts" WHERE "id" = NEW."attempt_id") = 'make-it-fast' THEN 0
        WHEN candidate."execution_cost" IS NULL THEN candidate."runtime_ms"
        ELSE 0
      END ASC,
      candidate."evaluated_at" ASC,
      candidate."evaluation_id" ASC
    LIMIT 1
  ), "updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
