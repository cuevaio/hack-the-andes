import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type {
  BrokenAgentHumanReview,
  SlowServiceApprovalSnapshot,
} from "@chofex/challenges-contract";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { HttpError } from "../registration/http";

import {
  consumeEvaluationApproval,
  createOrReuseEvaluationApproval,
  type EvaluationApprovalDatabase,
  evaluationApprovalForParticipant,
  evaluationApprovalOptions,
  parseApprovalAuthenticator,
  releaseEvaluationApproval,
  reviewDigestFor,
  verifyEvaluationApproval,
} from "./evaluation-approvals";

const review: BrokenAgentHumanReview = {
  sourceDigest:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  focus: "lease_recovery",
  failureScenario:
    "Un worker vencido termina después de que otro worker reclamó el mismo job.",
  evidence:
    "Revisé la carrera con dos workers y confirmé que el claim viejo no cambia el estado.",
  decision: "ship",
  confidence: 82,
  remainingRisk:
    "El store real todavía puede exhibir una latencia distinta a la simulada.",
};

describe("Broken Agent evaluation approvals", () => {
  let client: PGlite;
  let database: EvaluationApprovalDatabase;
  let participantId: string;
  let attemptId: string;

  beforeEach(async () => {
    client = new PGlite();
    await client.exec(`
      create table participants (
        id uuid primary key,
        clerk_user_id text not null unique
      );
      create table challenge_attempts (
        id uuid primary key,
        participant_id uuid not null references participants(id),
        challenge_slug text not null,
        challenge_version text not null default 'broken-agent-v3'
      );
      create table challenge_evaluation_approvals (
        id uuid primary key,
        attempt_id uuid not null references challenge_attempts(id) on delete cascade,
        source_digest varchar(64) not null,
        review_digest varchar(64) not null,
        review jsonb not null,
        ceremony_challenge text,
        ceremony_kind varchar(16),
        webauthn_origin text,
        relying_party_id varchar(255),
        credential_id text,
        expires_at timestamptz not null,
        approved_at timestamptz,
        consumed_at timestamptz,
        created_at timestamptz default now() not null,
        updated_at timestamptz default now() not null
      );
      create unique index challenge_evaluation_approvals_active_unique
        on challenge_evaluation_approvals (
          attempt_id,
          source_digest,
          review_digest
        ) where consumed_at is null;
      create table participant_passkeys (
        id uuid primary key default gen_random_uuid(),
        participant_id uuid not null references participants(id),
        credential_id text not null unique,
        public_key text not null,
        counter bigint default 0 not null,
        transports jsonb default '[]'::jsonb not null,
        device_type varchar(16) not null,
        backed_up boolean default false not null,
        created_at timestamptz default now() not null,
        updated_at timestamptz default now() not null
      );
    `);
    participantId = crypto.randomUUID();
    attemptId = crypto.randomUUID();
    await client.query(
      "insert into participants (id, clerk_user_id) values ($1, 'user_1')",
      [participantId],
    );
    await client.query(
      "insert into challenge_attempts (id, participant_id, challenge_slug) values ($1, $2, 'broken-agent')",
      [attemptId, participantId],
    );
    database = drizzle(client) as unknown as EvaluationApprovalDatabase;
  });

  afterEach(async () => {
    await client.close();
  });

  test("v3 displays the exact owned source and rejects foreign scope and tampered snapshots", async () => {
    await client.query(
      "update challenge_attempts set challenge_slug='make-it-fast', challenge_version='slow-service-v3' where id=$1",
      [attemptId],
    );
    const source = "function createLedger() { return {}; }";
    const sourceDigest = createHash("sha256").update(source).digest("hex");
    const snapshot: SlowServiceApprovalSnapshot = {
      challengeSlug: "make-it-fast",
      challengeVersion: "slow-service-v3",
      source,
      review: { ...review, sourceDigest, focus: "historical_percentiles" },
    };
    const approval = await createOrReuseEvaluationApproval(
      attemptId,
      sourceDigest,
      snapshot,
      database,
    );
    expect(
      (
        await evaluationApprovalForParticipant(
          "user_1",
          approval.id,
          database,
          "slow-service-v3",
        )
      )?.review,
    ).toEqual(snapshot);
    expect(
      await evaluationApprovalForParticipant(
        "foreign_user",
        approval.id,
        database,
        "slow-service-v3",
      ),
    ).toBeUndefined();
    expect(
      await evaluationApprovalForParticipant("user_1", approval.id, database),
    ).toBeUndefined();
    await expect(
      evaluationApprovalOptions(
        "foreign_user",
        "foreign@example.com",
        "Foreign",
        approval.id,
        "https://hacktheandes.com",
        "local-device",
        database,
        "slow-service-v3",
      ),
    ).rejects.toMatchObject({ code: "EVALUATION_APPROVAL_NOT_FOUND" });
    await expect(
      evaluationApprovalOptions(
        "user_1",
        "owner@example.com",
        "Owner",
        approval.id,
        "https://hacktheandes.com",
        "local-device",
        database,
      ),
    ).rejects.toMatchObject({ code: "EVALUATION_APPROVAL_NOT_FOUND" });
    await expect(
      verifyEvaluationApproval(
        "foreign_user",
        approval.id,
        {},
        database,
        "slow-service-v3",
      ),
    ).rejects.toMatchObject({ code: "EVALUATION_APPROVAL_NOT_FOUND" });
    await client.query(
      "update challenge_evaluation_approvals set approved_at=now() where id=$1",
      [approval.id],
    );
    expect(
      await consumeEvaluationApproval(
        attemptId,
        sourceDigest,
        {
          ...snapshot,
          review: {
            ...snapshot.review,
            evidence:
              "Different evidence must require another approval from the participant.",
          },
        },
        database,
      ),
    ).toBeUndefined();
    const competingConsumers = await Promise.all(
      Array.from({ length: 5 }, () =>
        consumeEvaluationApproval(attemptId, sourceDigest, snapshot, database),
      ),
    );
    expect(competingConsumers.filter((id) => id !== undefined)).toEqual([
      approval.id,
    ]);
    expect(
      await consumeEvaluationApproval(
        attemptId,
        sourceDigest,
        snapshot,
        database,
      ),
    ).toBeUndefined();
    await releaseEvaluationApproval(approval.id, database);
    expect(
      await consumeEvaluationApproval(
        attemptId,
        sourceDigest,
        snapshot,
        database,
      ),
    ).toBe(approval.id);
    await client.query(
      "update challenge_evaluation_approvals set review=jsonb_set(review, '{source}', to_jsonb($2::text)) where id=$1",
      [approval.id, source + " // changed"],
    );
    await expect(
      evaluationApprovalForParticipant(
        "user_1",
        approval.id,
        database,
        "slow-service-v3",
      ),
    ).rejects.toMatchObject({ code: "STALE_HUMAN_REVIEW" });
  });

  test("v3 block decision cannot begin the browser ceremony", async () => {
    await client.query(
      "update challenge_attempts set challenge_slug='make-it-fast', challenge_version='slow-service-v3' where id=$1",
      [attemptId],
    );
    const source = "function createLedger() { return {}; }";
    const sourceDigest = createHash("sha256").update(source).digest("hex");
    const snapshot: SlowServiceApprovalSnapshot = {
      challengeSlug: "make-it-fast",
      challengeVersion: "slow-service-v3",
      source,
      review: {
        ...review,
        sourceDigest,
        focus: "cpu_growth",
        decision: "block",
      },
    };
    const approval = await createOrReuseEvaluationApproval(
      attemptId,
      sourceDigest,
      snapshot,
      database,
    );
    await expect(
      evaluationApprovalOptions(
        "user_1",
        "owner@example.com",
        "Owner",
        approval.id,
        "https://hacktheandes.com",
        "local-device",
        database,
        "slow-service-v3",
      ),
    ).rejects.toMatchObject({ code: "REVIEW_BLOCKED" });
    expect(
      (
        await client.query<{ ceremony_challenge: string | null }>(
          "select ceremony_challenge from challenge_evaluation_approvals where id=$1",
          [approval.id],
        )
      ).rows[0]?.ceremony_challenge,
    ).toBeNull();
  });

  test("creates one source-bound handoff without consuming evaluation budget", async () => {
    const approvals = await Promise.all(
      Array.from({ length: 5 }, () =>
        createOrReuseEvaluationApproval(
          attemptId,
          review.sourceDigest,
          review,
          database,
        ),
      ),
    );

    expect(new Set(approvals.map((approval) => approval.id)).size).toBe(1);
    expect(
      await consumeEvaluationApproval(
        attemptId,
        review.sourceDigest,
        review,
        database,
      ),
    ).toBeUndefined();
    expect(
      await evaluationApprovalForParticipant(
        "user_1",
        approvals[0]?.id ?? "",
        database,
      ),
    ).toMatchObject({
      sourceDigest: review.sourceDigest,
      review,
    });
  });

  test("consumes an approved handoff exactly once and requires another approval", async () => {
    const approval = await createOrReuseEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );
    await client.query(
      "update challenge_evaluation_approvals set approved_at = now() where id = $1",
      [approval.id],
    );

    const consumed = await Promise.all(
      Array.from({ length: 5 }, () =>
        consumeEvaluationApproval(
          attemptId,
          review.sourceDigest,
          review,
          database,
        ),
      ),
    );
    expect(consumed.filter(Boolean)).toHaveLength(1);

    const next = await createOrReuseEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );
    expect(next.id).not.toBe(approval.id);
  });

  test("allows retry after an engine outage without another passkey ceremony", async () => {
    const approval = await createOrReuseEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );
    await client.query(
      "update challenge_evaluation_approvals set approved_at = now() where id = $1",
      [approval.id],
    );
    const claimed = await consumeEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );
    expect(claimed).toBe(approval.id);
    if (!claimed) throw new Error("Expected approved handoff");
    await releaseEvaluationApproval(claimed, database);
    expect(
      await consumeEvaluationApproval(
        attemptId,
        review.sourceDigest,
        review,
        database,
      ),
    ).toBe(approval.id);
    expect(
      await consumeEvaluationApproval(
        attemptId,
        review.sourceDigest,
        review,
        database,
      ),
    ).toBeUndefined();
  });

  test("does not resurrect an expired or superseded approval after failure", async () => {
    const approval = await createOrReuseEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );
    await client.query(
      "update challenge_evaluation_approvals set approved_at = now() where id = $1",
      [approval.id],
    );
    await consumeEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );
    const next = await createOrReuseEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );
    await releaseEvaluationApproval(approval.id, database);
    expect(
      await consumeEvaluationApproval(
        attemptId,
        review.sourceDigest,
        review,
        database,
      ),
    ).toBeUndefined();
    await client.query(
      "delete from challenge_evaluation_approvals where id = $1",
      [next.id],
    );
    await client.query(
      "update challenge_evaluation_approvals set expires_at = now() - interval '1 second' where id = $1",
      [approval.id],
    );
    await releaseEvaluationApproval(approval.id, database);
    expect(
      await consumeEvaluationApproval(
        attemptId,
        review.sourceDigest,
        review,
        database,
      ),
    ).toBeUndefined();
  });

  test("does not consume expired approval or reuse it", async () => {
    const approval = await createOrReuseEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );
    await client.query(
      `update challenge_evaluation_approvals
       set approved_at = now(), expires_at = now() - interval '1 second'
       where id = $1`,
      [approval.id],
    );

    expect(
      await consumeEvaluationApproval(
        attemptId,
        review.sourceDigest,
        review,
        database,
      ),
    ).toBeUndefined();
    const replacement = await createOrReuseEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );
    expect(replacement.id).not.toBe(approval.id);
  });

  test("binds approval identity to every participant-authored review field", () => {
    expect(
      reviewDigestFor({ ...review, confidence: review.confidence + 1 }),
    ).not.toBe(reviewDigestFor(review));
    expect(
      reviewDigestFor({
        ...review,
        evidence: `${review.evidence} Evidencia adicional.`,
      }),
    ).not.toBe(reviewDigestFor(review));
  });

  test("requires user verification when registering the participant passkey", async () => {
    const approval = await createOrReuseEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );
    const ceremony = await evaluationApprovalOptions(
      "user_1",
      "participant@example.com",
      "Participant",
      approval.id,
      "https://hacktheandes.com",
      "local-device",
      database,
    );

    expect(ceremony.kind).toBe("registration");
    expect(ceremony.options).toMatchObject({
      rp: { id: "hacktheandes.com" },
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      hints: ["client-device"],
    });
    const stored = await client.query<{
      ceremony_challenge: string | null;
      webauthn_origin: string | null;
      relying_party_id: string | null;
    }>(
      `select ceremony_challenge, webauthn_origin, relying_party_id
       from challenge_evaluation_approvals where id = $1`,
      [approval.id],
    );
    expect(stored.rows[0]).toMatchObject({
      webauthn_origin: "https://hacktheandes.com",
      relying_party_id: "hacktheandes.com",
    });
    expect(stored.rows[0]?.ceremony_challenge).not.toBeNull();
  });

  test("can register a security key when the computer has no platform authenticator", async () => {
    const approval = await createOrReuseEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );
    const ceremony = await evaluationApprovalOptions(
      "user_1",
      "participant@example.com",
      "Participant",
      approval.id,
      "https://hacktheandes.com",
      "security-key",
      database,
    );

    expect(ceremony.options).toMatchObject({
      authenticatorSelection: {
        authenticatorAttachment: "cross-platform",
        residentKey: "discouraged",
        userVerification: "required",
      },
      hints: ["security-key"],
    });
  });

  test("can replace a phone passkey with a credential on this computer", async () => {
    await client.query(
      `insert into participant_passkeys (
        participant_id,
        credential_id,
        public_key,
        transports,
        device_type,
        backed_up
      ) values ($1, 'phone-passkey', 'public-key', '["hybrid", "internal"]', 'multiDevice', true)`,
      [participantId],
    );
    const approval = await createOrReuseEvaluationApproval(
      attemptId,
      review.sourceDigest,
      review,
      database,
    );

    const ceremony = await evaluationApprovalOptions(
      "user_1",
      "participant@example.com",
      "Participant",
      approval.id,
      "https://hacktheandes.com",
      "replace-local-device",
      database,
    );

    expect(ceremony.kind).toBe("registration");
    expect(ceremony.options).toMatchObject({
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      hints: ["client-device"],
    });
    const stored = await client.query<{ ceremony_kind: string | null }>(
      "select ceremony_kind from challenge_evaluation_approvals where id = $1",
      [approval.id],
    );
    expect(stored.rows[0]?.ceremony_kind).toBe("replacement");
  });

  test("rejects an authenticator that would send the participant to a phone passkey", () => {
    expect(parseApprovalAuthenticator("local-device")).toBe("local-device");
    expect(parseApprovalAuthenticator("replace-local-device")).toBe(
      "replace-local-device",
    );
    try {
      parseApprovalAuthenticator("phone");
      throw new Error("expected the phone authenticator to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      if (!(error instanceof HttpError)) throw error;
      expect(error.status).toBe(400);
      expect(error.code).toBe("INVALID_APPROVAL_AUTHENTICATOR");
    }
  });
});
