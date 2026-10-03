import { mock } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

const client = new PGlite();
mock.module("server-only", () => ({}));
mock.module("@chofex/db", () => ({ db: drizzle(client) }));
process.env.CHALLENGES_FORCE_OPEN = "true";
process.env.CHALLENGE_ENGINE_URL = "https://engine.test";
process.env.CHALLENGE_ENGINE_API_SECRET = "test-secret";
const { evaluateChallenge } = await import("../service");

const migrations = new URL(
  "../../../../../packages/db/drizzle/",
  import.meta.url,
);
for (const migration of (await readdir(migrations))
  .filter((file) => file.endsWith(".sql"))
  .sort()) {
  const sql = await Bun.file(new URL(migration, migrations)).text();
  await client.exec(sql.replaceAll("--> statement-breakpoint", ""));
}
const participantId = crypto.randomUUID();
const attemptId = crypto.randomUUID();
await client.query(
  "insert into participants (id, clerk_user_id, name) values ($1, 'user_retry', 'Test')",
  [participantId],
);
await client.query(
  `insert into challenge_attempts (
  id, participant_id, challenge_slug, challenge_version, share_code, queries_limit, evaluations_limit
) values ($1, $2, 'broken-agent', 'broken-agent-v3', 'TEST', 0, 3)`,
  [attemptId, participantId],
);

const source = "function createScheduler() { return {}; }";
const solution = {
  kind: "javascript_source",
  source,
  review: {
    sourceDigest: createHash("sha256").update(source).digest("hex"),
    focus: "lease_recovery",
    decision: "ship",
    confidence: 80,
    failureScenario: "Un worker termina después de que vence su lease.",
    evidence: "Revisé una carrera entre dos workers con un reloj controlado.",
    remainingRisk:
      "La latencia del store real puede cambiar el comportamiento.",
  },
};
// Before rankings open, to keep this test focused on submission persistence.
const evaluate = () =>
  evaluateChallenge(
    "user_retry",
    "broken-agent",
    solution,
    new Date("2026-09-20T12:00:00Z"),
  );
const errorCode = (code: string) => (error: unknown) =>
  error instanceof Error && "code" in error && error.code === code;

try {
  await assert.rejects(evaluate, errorCode("HUMAN_APPROVAL_REQUIRED"));
  await client.query(
    "update challenge_evaluation_approvals set approved_at = now() where attempt_id = $1",
    [attemptId],
  );
  const originalError = console.error;
  console.error = () => {};
  globalThis.fetch = mock(async () =>
    Response.json(
      {
        version: 1,
        error: { code: "ENGINE_ERROR", message: "Unavailable" },
      },
      { status: 500 },
    ),
  ) as unknown as typeof fetch;
  try {
    await assert.rejects(evaluate, errorCode("CHALLENGE_ENGINE_UNAVAILABLE"));
  } finally {
    console.error = originalError;
  }
  const budget = await client.query(
    "select evaluations_used, evaluations_pending from challenge_attempts",
  );
  assert.deepEqual(budget.rows, [
    { evaluations_used: 0, evaluations_pending: 0 },
  ]);

  globalThis.fetch = mock(async () =>
    Response.json(
      {
        version: 1,
        error: {
          code: "SOLUTION_DID_NOT_COMPLETE",
          message: "Revisa las promesas de tu scheduler.",
        },
      },
      { status: 422 },
    ),
  ) as unknown as typeof fetch;
  console.error = () => {};
  try {
    await assert.rejects(evaluate, errorCode("SOLUTION_DID_NOT_COMPLETE"));
  } finally {
    console.error = originalError;
  }

  globalThis.fetch = mock(async () =>
    Response.json({
      version: 1,
      score: {
        accuracy: 0.5,
        exactCount: 50,
        sampleSize: 100,
        meanError: 50,
        queriesUsed: 0,
        runtimeMs: 0,
      },
    }),
  ) as unknown as typeof fetch;
  // A database failure after scoring must also preserve approval and budget.
  await client.exec(`create function reject_test_result() returns trigger language plpgsql as $$
    begin raise exception 'test persistence failure'; end $$;
    create trigger reject_test_result before insert on challenge_evaluations
    for each row execute function reject_test_result();`);
  await assert.rejects(
    evaluate,
    (error: unknown) =>
      error instanceof Error &&
      error.cause instanceof Error &&
      error.cause.message === "test persistence failure",
  );
  await client.exec("drop trigger reject_test_result on challenge_evaluations");
  const result = await evaluate();
  assert.equal(result.evaluationsUsed, 1);
  assert.equal(result.accuracy, 0.5);
  const saved = await client.query<{ solution: unknown }>(
    "select solution from challenge_evaluations",
  );
  assert.equal(saved.rows.length, 1);
  assert.deepEqual(saved.rows[0]?.solution, solution);
  await assert.rejects(evaluate, errorCode("HUMAN_APPROVAL_REQUIRED"));
  const slowAttemptId = crypto.randomUUID();
  await client.query(
    `insert into challenge_attempts (
      id, participant_id, challenge_slug, challenge_version, share_code, queries_limit, evaluations_limit
    ) values ($1, $2, 'make-it-fast', 'slow-service-v3', 'SLOW', 0, 5)`,
    [slowAttemptId, participantId],
  );
  const ledgerSource = "function createLedger() { return {}; }";
  const ledgerSolution = {
    kind: "javascript_source",
    source: ledgerSource,
    review: {
      ...solution.review,
      focus: "cpu_growth",
      sourceDigest: createHash("sha256").update(ledgerSource).digest("hex"),
    },
  };
  const evaluateLedger = () =>
    evaluateChallenge(
      "user_retry",
      "make-it-fast",
      ledgerSolution,
      new Date("2026-10-03T04:00:00Z"),
    );
  await assert.rejects(evaluateLedger, errorCode("HUMAN_APPROVAL_REQUIRED"));
  await client.query(
    "update challenge_evaluation_approvals set approved_at = now() where attempt_id = $1",
    [slowAttemptId],
  );
  // The server persisted the verdict, but the caller lost the response.
  const delivered = await evaluateLedger();
  globalThis.fetch = mock(async () => {
    throw new Error("must reuse stored verdict");
  }) as unknown as typeof fetch;
  const replay = await evaluateLedger();
  assert.deepEqual(replay, delivered);
  assert.equal(replay.evaluationsUsed, 1);
  assert.equal(replay.evaluationsRemaining, 4);
  // Recovery also works after approval expiration and exhaustion of the budget.
  await client.query(
    "update challenge_evaluation_approvals set expires_at = now() - interval '1 hour' where attempt_id = $1",
    [slowAttemptId],
  );
  await client.query(
    "update challenge_attempts set evaluations_used = 5 where id = $1",
    [slowAttemptId],
  );
  const exhaustedReplay = await evaluateLedger();
  assert.equal(exhaustedReplay.evaluationsUsed, 5);
  assert.equal(exhaustedReplay.accuracy, delivered.accuracy);
  assert.equal(
    (
      await client.query(
        "select id from challenge_evaluations where attempt_id = $1",
        [slowAttemptId],
      )
    ).rows.length,
    1,
  );
  console.log("evaluation retry passed");
} finally {
  await client.close();
}
