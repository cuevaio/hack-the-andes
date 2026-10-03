import { mock } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import {
  challengeBySlug,
  JavascriptSourceSolutionSchema,
} from "@chofex/challenges-contract";
import {
  slowServiceChallengeVersion,
  slowServiceStarterSource,
} from "@chofex/challenges-contract/slow-service";
import { slowServiceToolkit } from "@chofex/challenges-contract/slow-service/toolkit";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { Effect, Schema } from "effect";

// The released catalog is active; do not modify it in this fixture.
const challenge = challengeBySlug("make-it-fast");
if (!challenge) throw new Error("missing challenge");
assert.equal(challenge.playable, true);
const client = new PGlite();
mock.module("server-only", () => ({}));
mock.module("@chofex/db", () => ({ db: drizzle(client) }));
mock.module("../../funnel-reminders/enqueue", () => ({
  enqueueChallengeFinishReminderBestEffort: async () => undefined,
}));
mock.module("../../posthog-server", () => ({
  captureProductEvent: async () => undefined,
}));
process.env.CLERK_CLI_OAUTH_CLIENT_ID = "test-cli";
process.env.CLERK_AUTHORIZED_PARTIES = "https://hacktheandes.com";
mock.module("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    authenticateRequest: async (
      request: Request,
      options: { acceptsToken: string },
    ) => {
      const token = request.headers.get("authorization");
      const oauth = token === "Bearer cli-token";
      const browser =
        token === "Bearer browser-token" || token === "Bearer foreign-token";
      return {
        isAuthenticated:
          options.acceptsToken === "oauth_token" ? oauth : browser,
        toAuth: () => ({
          tokenType: oauth ? "oauth_token" : "session_token",
          clientId: "test-cli",
          userId:
            token === "Bearer foreign-token" ? "foreign_user" : "user_ledger",
        }),
      };
    },
    users: {
      getUser: async () => ({
        primaryEmailAddressId: "email",
        emailAddresses: [{ id: "email", emailAddress: "owner@example.com" }],
        firstName: "Ledger",
        lastName: "Participant",
        publicMetadata: {},
        privateMetadata: {},
        hasImage: false,
      }),
    },
  }),
}));
// A protocol-only source while the real participant starter is pending.
const source =
  slowServiceStarterSource ?? "function createLedger(setup) { return {}; }";
let engineAvailable = false;
let initializationRejected = false;
let engineBusy = false;
let enginePoints = 85;
let received: unknown;
const engine = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: async (request) => {
    assert.equal(new URL(request.url).pathname, "/api/v1/evaluate");
    assert.equal(request.headers.get("authorization"), "Bearer test-secret");
    received = await request.json();
    if (!engineAvailable)
      return Response.json(
        { version: 1, error: { code: "ENGINE_ERROR", message: "Unavailable" } },
        { status: 503 },
      );
    if (initializationRejected)
      return Response.json(
        {
          version: 1,
          error: {
            code: "SOLUTION_EXECUTION_FAILED",
            message: "Define function createLedger(setup)",
          },
        },
        { status: 422 },
      );
    if (engineBusy)
      return Response.json(
        {
          version: 1,
          error: {
            code: "ENGINE_BUSY",
            message: "Guest admission is occupied",
          },
        },
        { status: 503 },
      );
    return Response.json({
      version: 1,
      score: {
        accuracy: enginePoints / 100,
        exactCount: enginePoints,
        sampleSize: 100,
        meanError: 100 - enginePoints,
        queriesUsed: 0,
        runtimeMs: 150,
        executionCost: 150_000,
      },
    });
  },
});
process.env.CHALLENGE_ENGINE_URL = engine.url.toString();
process.env.CHALLENGE_ENGINE_API_SECRET = "test-secret";
const { evaluateChallenge, getChallengeAttempt, testChallengeSolution } =
  await import("../service");
const { getChallengeRanking } = await import("../ranking");
const { participantHasLatestRankedChallengeResult } = await import(
  "../../admin/admission-policy"
);
const { challengePlacementForParticipant } = await import(
  "../../credential/placement"
);
const { createChallengeScaffold } = await import(
  "../../../../cli/src/challenge-scaffold"
);
const { POST: approvalOptions } = await import(
  "../../../app/api/v1/challenges/make-it-fast/approvals/[approvalId]/options/route"
);
const { POST: approvalVerify } = await import(
  "../../../app/api/v1/challenges/make-it-fast/approvals/[approvalId]/verify/route"
);
const { POST: evaluationRoute } = await import(
  "../../../app/api/v1/challenges/[slug]/evaluate/route"
);
const approvalRequest = (token: string | undefined) =>
  new Request(
    "https://hacktheandes.com/api/v1/challenges/make-it-fast/approvals/test/options",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: "{}",
    },
  );
const directory = await mkdtemp("/tmp/opencode/slow-service-flow-");
const previousDirectory = process.cwd();
const now = new Date("2026-10-02T12:00:00Z");
const solution = { kind: "javascript_source", source } as const;
const hasCode = (code: string) => (error: unknown) =>
  error instanceof Error && "code" in error && error.code === code;

const reviewFor = (candidate: string) => ({
  sourceDigest: createHash("sha256").update(candidate).digest("hex"),
  focus: "historical_percentiles" as const,
  failureScenario:
    "Two debit legs of 100 and 300 must return P50=100 and P100=300.",
  evidence:
    "The supplied public tests checked exact outputs before submitting this source.",
  decision: "ship" as const,
  confidence: 80,
  remainingRisk:
    "Maximum retained history still needs a separate full-capacity benchmark.",
});
// This local database fixture confirms the handoff after its source snapshot is
// checked. The real passkey ceremony is exercised by the approval/auth tests.
const evaluateReviewed = async (
  ...args: Parameters<typeof evaluateChallenge>
) => {
  const usageBefore = (
    await getChallengeAttempt("user_ledger", "make-it-fast", now)
  ).progress.evaluationsUsed;
  const candidateSolution = Schema.decodeUnknownSync(
    JavascriptSourceSolutionSchema,
  )(args[2]);
  const candidate = candidateSolution.source;
  const reviewed = { ...candidateSolution, review: reviewFor(candidate) };
  const invoke = () => evaluateChallenge(args[0], args[1], reviewed, args[3]);
  try {
    return await invoke();
  } catch (error) {
    if (!hasCode("HUMAN_APPROVAL_REQUIRED")(error)) throw error;
    const { rows } = await client.query<{ id: string; review: unknown }>(
      "select p.id, p.review from challenge_evaluation_approvals p join challenge_attempts a on a.id=p.attempt_id where a.challenge_version=$1 and p.consumed_at is null order by p.created_at desc limit 1",
      [slowServiceChallengeVersion],
    );
    const approval = rows[0];
    assert.ok(approval);
    const apiHandoff = await evaluationRoute(
      new Request(
        "https://hacktheandes.com/api/v1/challenges/make-it-fast/evaluate",
        {
          method: "POST",
          headers: {
            authorization: "Bearer cli-token",
            "content-type": "application/json",
          },
          body: JSON.stringify(reviewed),
        },
      ),
      { params: Promise.resolve({ slug: "make-it-fast" }) },
    );
    assert.equal(apiHandoff.status, 428);
    const envelope = await apiHandoff.json();
    assert.equal(envelope.version, 1);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(
      envelope.error.details.approvalUrl,
      `https://hacktheandes.com/challenges/make-it-fast/approve/${approval.id}`,
    );
    assert.deepEqual(approval.review, {
      challengeSlug: "make-it-fast",
      challengeVersion: slowServiceChallengeVersion,
      source: candidate,
      review: reviewFor(candidate),
    });
    const { evaluationApprovalForParticipant } = await import(
      "../evaluation-approvals"
    );
    assert.equal(
      await evaluationApprovalForParticipant(
        "foreign_user",
        approval.id,
        undefined,
        "slow-service-v3",
      ),
      undefined,
    );
    assert.equal(
      await evaluationApprovalForParticipant("user_ledger", approval.id),
      undefined,
    );
    const view = await evaluationApprovalForParticipant(
      "user_ledger",
      approval.id,
      undefined,
      "slow-service-v3",
    );
    assert.deepEqual(view?.review, approval.review);
    for (const handler of [approvalOptions, approvalVerify]) {
      const context = { params: Promise.resolve({ approvalId: approval.id }) };
      const oauthResponse = await handler(
        approvalRequest("cli-token"),
        context,
      );
      assert.equal(oauthResponse.status, 403);
      assert.equal(
        (await oauthResponse.json()).error.code,
        "BROWSER_SESSION_REQUIRED",
      );
      const unauthenticated = await handler(
        approvalRequest(undefined),
        context,
      );
      assert.equal(unauthenticated.status, 401);
      const foreign = await handler(approvalRequest("foreign-token"), context);
      assert.equal(foreign.status, 404);
      assert.equal(
        (await foreign.json()).error.code,
        "EVALUATION_APPROVAL_NOT_FOUND",
      );
      const wrongScope = await handler(approvalRequest("browser-token"), {
        params: Promise.resolve({ approvalId: crypto.randomUUID() }),
      });
      assert.equal(wrongScope.status, 404);
    }
    assert.equal(
      (await getChallengeAttempt("user_ledger", "make-it-fast", now)).progress
        .evaluationsUsed,
      usageBefore,
    );
    await client.query(
      "update challenge_evaluation_approvals set approved_at=now() where id=$1",
      [approval.id],
    );
    return invoke();
  }
};

try {
  const migrations = new URL(
    "../../../../../packages/db/drizzle/",
    import.meta.url,
  );
  for (const migration of (await readdir(migrations))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await client.exec(
      (await Bun.file(new URL(migration, migrations)).text()).replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
  }
  const participantId = crypto.randomUUID();
  await client.query(
    "insert into participants (id, clerk_user_id, name) values ($1, 'user_ledger', 'Ledger participant')",
    [participantId],
  );
  await client.query(
    "insert into applications (participant_id, status) values ($1, 'draft')",
    [participantId],
  );

  const historicalRecords: { readonly id: string; readonly version: string }[] =
    [];
  for (const version of ["slow-service-v1", "slow-service-v2"]) {
    const historicalAttemptId = crypto.randomUUID();
    const historicalEvaluationId = crypto.randomUUID();
    historicalRecords.push({ id: historicalAttemptId, version });
    await client.query(
      "insert into challenge_attempts (id, participant_id, challenge_slug, challenge_version, share_code, queries_limit, evaluations_limit) values ($1, $2, 'make-it-fast', $3, $4, 0, 5)",
      [
        historicalAttemptId,
        participantId,
        version,
        `OLD${historicalRecords.length}`,
      ],
    );
    await client.query(
      'insert into challenge_evaluations (id, attempt_id, solution_kind, solution, accuracy, exact_count, sample_size, mean_error, queries_used, runtime_ms) values ($1, $2, \'javascript_source\', \'{"source":"historical test record","challengeSlug":"make-it-fast"}\', 1, 100, 100, 0, 0, 1)',
      [historicalEvaluationId, historicalAttemptId],
    );
    await client.query(
      "update challenge_attempts set evaluations_used = 1, best_evaluation_id = $1 where id = $2",
      [historicalEvaluationId, historicalAttemptId],
    );
  }
  await client.query(
    "update applications set status = 'submitted' where participant_id = $1",
    [participantId],
  );
  assert.equal(
    (await getChallengeRanking("make-it-fast", now)).competitorCount,
    0,
  );
  assert.equal(
    await participantHasLatestRankedChallengeResult(participantId),
    false,
  );
  await client.query(
    "update applications set status = 'draft' where participant_id = $1",
    [participantId],
  );

  process.chdir(directory);
  if (slowServiceToolkit.kind === "ready") {
    assert.deepEqual(
      await Effect.runPromise(createChallengeScaffold("make-it-fast")),
      { challenge: "make-it-fast", path: "slow-service", status: "created" },
    );
    assert.equal(await Bun.file("slow-service/ledger.js").text(), source);
    for (const [name, expected] of Object.entries(slowServiceToolkit.files)) {
      assert.equal(await Bun.file(`slow-service/${name}`).text(), expected);
    }
    await Bun.write("slow-service/ledger.js", "// participant work");
    assert.equal(
      (await Effect.runPromise(createChallengeScaffold("make-it-fast"))).status,
      "exists",
    );
    assert.equal(
      await Bun.file("slow-service/ledger.js").text(),
      "// participant work",
    );
  } else {
    const error = await Effect.runPromise(
      Effect.flip(createChallengeScaffold("make-it-fast")),
    );
    assert.equal(error.code, "SLOW_SERVICE_TOOLKIT_NOT_READY");
    assert.deepEqual(await readdir(directory), []);
  }
  process.chdir(previousDirectory);

  if (slowServiceToolkit.kind === "ready") {
    const publicResult = await testChallengeSolution(
      "user_ledger",
      "make-it-fast",
      solution,
      now,
    );
    assert.equal(publicResult.accuracy, 1);
  } else {
    await assert.rejects(
      () => testChallengeSolution("user_ledger", "make-it-fast", solution, now),
      hasCode("SLOW_SERVICE_TOOLKIT_NOT_READY"),
    );
  }
  const before = await getChallengeAttempt("user_ledger", "make-it-fast", now);
  assert.equal(before.progress.evaluationsUsed, 0);
  assert.equal(before.challenge.challengeVersion, slowServiceChallengeVersion);
  assert.equal(before.progress.evaluationsLimit, 5);
  await assert.rejects(
    () => evaluateChallenge("user_ledger", "make-it-fast", solution, now),
    hasCode("HUMAN_REVIEW_REQUIRED"),
  );
  await assert.rejects(
    () =>
      evaluateChallenge(
        "user_ledger",
        "make-it-fast",
        {
          ...solution,
          review: { ...reviewFor(source), sourceDigest: "0".repeat(64) },
        },
        now,
      ),
    hasCode("STALE_HUMAN_REVIEW"),
  );
  await assert.rejects(
    () =>
      evaluateChallenge(
        "user_ledger",
        "make-it-fast",
        { ...solution, review: { ...reviewFor(source), decision: "block" } },
        now,
      ),
    hasCode("REVIEW_BLOCKED"),
  );
  assert.equal(received, undefined);
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      () => evaluateReviewed("user_ledger", "make-it-fast", solution, now),
      hasCode("CHALLENGE_ENGINE_UNAVAILABLE"),
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(
    (await getChallengeAttempt("user_ledger", "make-it-fast", now)).progress
      .evaluationsUsed,
    0,
  );

  engineAvailable = true;
  engineBusy = true;
  console.error = () => {};
  try {
    await assert.rejects(
      () => evaluateReviewed("user_ledger", "make-it-fast", solution, now),
      (error: unknown) =>
        error instanceof Error &&
        "status" in error &&
        error.status === 503 &&
        "retryable" in error &&
        error.retryable === true,
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(
    (await getChallengeAttempt("user_ledger", "make-it-fast", now)).progress
      .evaluationsUsed,
    0,
  );
  assert.deepEqual(
    (await client.query("select * from challenge_reservations")).rows,
    [],
  );
  engineBusy = false;
  initializationRejected = true;
  console.error = () => {};
  try {
    await assert.rejects(
      () => evaluateReviewed("user_ledger", "make-it-fast", solution, now),
      hasCode("SOLUTION_EXECUTION_FAILED"),
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(
    (await getChallengeAttempt("user_ledger", "make-it-fast", now)).progress
      .evaluationsUsed,
    0,
    "a rejected Slow Service initialization must not consume an attempt",
  );
  assert.deepEqual(
    (await client.query("select * from challenge_reservations")).rows,
    [],
  );
  initializationRejected = false;
  const result = await evaluateReviewed(
    "user_ledger",
    "make-it-fast",
    solution,
    now,
  );
  assert.equal(result.evaluationsUsed, 1);
  assert.equal(result.evaluationsRemaining, 4);
  assert.equal(result.exactCount, 85);
  assert.equal(result.runtimeMs, 150);
  assert.equal(result.rank, undefined);
  assert.equal(
    (await getChallengeRanking("make-it-fast", now)).competitorCount,
    0,
  );
  const attempts = await client.query<{
    id: string;
    challenge_version: string;
  }>(
    "select id, challenge_version from challenge_attempts where challenge_version = $1",
    [slowServiceChallengeVersion],
  );
  assert.equal(
    attempts.rows[0]?.challenge_version,
    slowServiceChallengeVersion,
  );
  assert.deepEqual(received, {
    version: 1,
    challengeVersion: slowServiceChallengeVersion,
    participantKey: attempts.rows[0]?.id,
    source,
    queriesUsed: 0,
  });
  const persisted = await client.query<{ digest: string }>(
    "select solution->>'sourceDigest' as digest from challenge_evaluations where attempt_id = $1",
    [attempts.rows[0]?.id],
  );
  assert.equal(
    persisted.rows[0]?.digest,
    createHash("sha256").update(source).digest("hex"),
  );
  assert.equal(
    (await client.query("select * from challenge_evaluation_approvals")).rows
      .length,
    1,
  );

  await client.query(
    "update applications set status = 'submitted' where participant_id = $1",
    [participantId],
  );
  const ranked = await getChallengeRanking("make-it-fast", now);
  assert.equal(ranked.entries[0]?.rank, 1);
  assert.equal(ranked.entries[0]?.displayName, "Ledger participant");
  assert.equal(
    await participantHasLatestRankedChallengeResult(participantId),
    true,
  );
  assert.equal(
    await challengePlacementForParticipant(participantId),
    "MAKE IT FAST · #01",
  );
  assert.equal(
    (await getChallengeAttempt("user_ledger", "make-it-fast", now)).progress
      .rank,
    1,
  );
  enginePoints = 60;
  const revisedSource = `${source}\n// Revised submission`;
  const revisedSolution = {
    ...solution,
    source: revisedSource,
    review: reviewFor(revisedSource),
  };
  const correctnessOnly = await evaluateReviewed(
    "user_ledger",
    "make-it-fast",
    revisedSolution,
    now,
  );
  assert.equal(correctnessOnly.exactCount, 60);
  assert.equal(correctnessOnly.accuracy, 0.6);
  assert.equal(correctnessOnly.evaluationsUsed, 2);
  assert.equal(correctnessOnly.evaluationsRemaining, 3);
  assert.equal(
    (await getChallengeAttempt("user_ledger", "make-it-fast", now)).progress
      .bestAccuracy,
    0.85,
  );
  await assert.rejects(
    () => evaluateChallenge("user_ledger", "broken-agent", solution, now),
    hasCode("CHALLENGE_CLOSED"),
  );
  for (const historical of historicalRecords) {
    assert.deepEqual(
      (
        await client.query<{
          challenge_version: string;
          source: string;
          exact_count: number;
        }>(
          "select a.challenge_version, e.solution->>'source' as source, e.exact_count from challenge_attempts a join challenge_evaluations e on e.id = a.best_evaluation_id where a.id = $1",
          [historical.id],
        )
      ).rows,
      [
        {
          challenge_version: historical.version,
          source: "historical test record",
          exact_count: 100,
        },
      ],
    );
  }
  console.log("slow service flow passed");
} finally {
  process.chdir(previousDirectory);
  engine.stop(true);
  await client.close();
  await rm(directory, { recursive: true, force: true });
}
