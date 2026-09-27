import { createHash } from "node:crypto";
import type { BrokenAgentHumanReview } from "@chofex/challenges-contract";
import type { db } from "@chofex/db";
import { sql } from "@chofex/db/orm";
import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

import { HttpError } from "@/lib/registration/http";

export type EvaluationApprovalDatabase = Pick<typeof db, "execute">;

const approvalLifetimeMs = 10 * 60 * 1_000;
const ceremonyTimeoutMs = 5 * 60 * 1_000;

interface ApprovalRow extends Record<string, unknown> {
  readonly id: string;
  readonly attempt_id: string;
  readonly participant_id: string;
  readonly source_digest: string;
  readonly review_digest: string;
  readonly review: BrokenAgentHumanReview;
  readonly ceremony_challenge: string | null;
  readonly ceremony_kind: string | null;
  readonly webauthn_origin: string | null;
  readonly relying_party_id: string | null;
  readonly expires_at: Date | string;
  readonly approved_at: Date | string | null;
  readonly consumed_at: Date | string | null;
}

interface PasskeyRow extends Record<string, unknown> {
  readonly credential_id: string;
  readonly public_key: string;
  readonly counter: number | string;
  readonly transports: string[];
}

interface IdentifierRow extends Record<string, unknown> {
  readonly id: string;
}

export interface EvaluationApprovalView {
  readonly id: string;
  readonly sourceDigest: string;
  readonly review: BrokenAgentHumanReview;
  readonly expiresAt: string;
  readonly approvedAt?: string;
  readonly consumedAt?: string;
}

const approvalDatabase = async (
  database: EvaluationApprovalDatabase | undefined,
): Promise<EvaluationApprovalDatabase> => {
  if (database) return database;
  return (await import("@chofex/db")).db;
};

const instant = (value: Date | string): string => new Date(value).toISOString();

const toView = (row: ApprovalRow): EvaluationApprovalView => {
  let approved: { readonly approvedAt?: string } = {};
  if (row.approved_at) approved = { approvedAt: instant(row.approved_at) };
  let consumed: { readonly consumedAt?: string } = {};
  if (row.consumed_at) consumed = { consumedAt: instant(row.consumed_at) };
  return {
    id: row.id,
    sourceDigest: row.source_digest,
    review: row.review,
    expiresAt: instant(row.expires_at),
    ...approved,
    ...consumed,
  };
};

export const reviewDigestFor = (review: BrokenAgentHumanReview): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        sourceDigest: review.sourceDigest,
        focus: review.focus,
        failureScenario: review.failureScenario,
        evidence: review.evidence,
        decision: review.decision,
        confidence: review.confidence,
        remainingRisk: review.remainingRisk,
      }),
    )
    .digest("hex");

export const createOrReuseEvaluationApproval = async (
  attemptId: string,
  sourceDigest: string,
  review: BrokenAgentHumanReview,
  database?: EvaluationApprovalDatabase,
): Promise<EvaluationApprovalView> => {
  const client = await approvalDatabase(database);
  const approvalId = crypto.randomUUID();
  const reviewDigest = reviewDigestFor(review);
  const expiresAt = new Date(Date.now() + approvalLifetimeMs);
  const result = await client.execute<ApprovalRow>(sql`
    with expired as (
      update "challenge_evaluation_approvals"
      set "consumed_at" = now(), "updated_at" = now()
      where
        "attempt_id" = ${attemptId}
        and "source_digest" = ${sourceDigest}
        and "review_digest" = ${reviewDigest}
        and "consumed_at" is null
        and "expires_at" <= now()
      returning "id"
    ), locked_attempt as (
      select "id"
      from "challenge_attempts"
      where "id" = ${attemptId}
      for update
    ), existing as (
      select approval.*
      from "challenge_evaluation_approvals" as approval
      cross join locked_attempt
      where
        approval."attempt_id" = ${attemptId}
        and approval."source_digest" = ${sourceDigest}
        and approval."review_digest" = ${reviewDigest}
        and approval."consumed_at" is null
        and approval."expires_at" > now()
      order by approval."created_at" desc
      limit 1
    ), created as (
      insert into "challenge_evaluation_approvals" (
        "id",
        "attempt_id",
        "source_digest",
        "review_digest",
        "review",
        "expires_at"
      )
      select
        ${approvalId},
        locked_attempt."id",
        ${sourceDigest},
        ${reviewDigest},
        ${JSON.stringify(review)}::jsonb,
        ${expiresAt}
      from locked_attempt
      cross join (select count(*) from expired) as expired_count
      where not exists (select 1 from existing)
      on conflict do nothing
      returning *
    )
    select
      approval.*,
      attempt."participant_id"
    from (
      select * from existing
      union all
      select * from created
    ) as approval
    join "challenge_attempts" as attempt on attempt."id" = approval."attempt_id"
    limit 1
  `);
  let row = result.rows[0];
  if (!row) {
    const retry = await client.execute<ApprovalRow>(sql`
      select approval.*, attempt."participant_id"
      from "challenge_evaluation_approvals" as approval
      join "challenge_attempts" as attempt
        on attempt."id" = approval."attempt_id"
      where
        approval."attempt_id" = ${attemptId}
        and approval."source_digest" = ${sourceDigest}
        and approval."review_digest" = ${reviewDigest}
        and approval."consumed_at" is null
        and approval."expires_at" > now()
      order by approval."created_at" desc
      limit 1
    `);
    row = retry.rows[0];
  }
  if (!row) throw new Error("Could not create evaluation approval");
  return toView(row);
};

export const consumeEvaluationApproval = async (
  attemptId: string,
  sourceDigest: string,
  review: BrokenAgentHumanReview,
  database?: EvaluationApprovalDatabase,
): Promise<boolean> => {
  const client = await approvalDatabase(database);
  const reviewDigest = reviewDigestFor(review);
  const result = await client.execute<IdentifierRow>(sql`
    update "challenge_evaluation_approvals"
    set "consumed_at" = now(), "updated_at" = now()
    where "id" = (
      select "id"
      from "challenge_evaluation_approvals"
      where
        "attempt_id" = ${attemptId}
        and "source_digest" = ${sourceDigest}
        and "review_digest" = ${reviewDigest}
        and "approved_at" is not null
        and "consumed_at" is null
        and "expires_at" > now()
      order by "approved_at" desc
      for update skip locked
      limit 1
    )
    returning "id"
  `);
  return result.rows.length === 1;
};

const approvalForParticipant = async (
  clerkUserId: string,
  approvalId: string,
  database?: EvaluationApprovalDatabase,
): Promise<ApprovalRow | undefined> => {
  const client = await approvalDatabase(database);
  const result = await client.execute<ApprovalRow>(sql`
    select
      approval.*,
      attempt."participant_id"
    from "challenge_evaluation_approvals" as approval
    join "challenge_attempts" as attempt
      on attempt."id" = approval."attempt_id"
    join "participants" as participant
      on participant."id" = attempt."participant_id"
    where
      approval."id" = ${approvalId}
      and participant."clerk_user_id" = ${clerkUserId}
      and attempt."challenge_slug" = 'broken-agent'
    limit 1
  `);
  return result.rows[0];
};

export const evaluationApprovalForParticipant = async (
  clerkUserId: string,
  approvalId: string,
  database?: EvaluationApprovalDatabase,
): Promise<EvaluationApprovalView | undefined> => {
  const row = await approvalForParticipant(clerkUserId, approvalId, database);
  if (!row) return;
  return toView(row);
};

const activeApproval = (row: ApprovalRow): void => {
  if (row.consumed_at) {
    throw new HttpError(
      409,
      "APPROVAL_ALREADY_USED",
      "This evaluation approval has already been used",
    );
  }
  if (row.approved_at) {
    throw new HttpError(
      409,
      "APPROVAL_ALREADY_CONFIRMED",
      "This evaluation approval is already confirmed",
    );
  }
  if (Date.parse(String(row.expires_at)) <= Date.now()) {
    throw new HttpError(
      410,
      "EVALUATION_APPROVAL_EXPIRED",
      "This evaluation approval has expired; retry the CLI command",
    );
  }
};

export type ApprovalAuthenticator = "local-device" | "security-key";

export const parseApprovalAuthenticator = (
  value: unknown,
): ApprovalAuthenticator => {
  if (value === "local-device" || value === "security-key") return value;
  throw new HttpError(
    400,
    "INVALID_APPROVAL_AUTHENTICATOR",
    "Choose this computer or a security key",
  );
};

const registrationPreferences = (
  authenticator: ApprovalAuthenticator,
): {
  readonly authenticatorSelection: {
    readonly residentKey: "discouraged";
    readonly userVerification: "required";
  };
  readonly preferredAuthenticatorType: "localDevice" | "securityKey";
} => {
  let preferredAuthenticatorType: "localDevice" | "securityKey" = "localDevice";
  if (authenticator === "security-key") {
    preferredAuthenticatorType = "securityKey";
  }
  return {
    // A preferred resident key is a synced passkey. Chrome stores that in
    // Google Password Manager, and Workspace admins can disable it — the
    // phone QR flow then fails before Windows Hello is offered. A
    // non-discoverable platform credential still requires user verification.
    authenticatorSelection: {
      residentKey: "discouraged",
      userVerification: "required",
    },
    preferredAuthenticatorType,
  };
};

const relyingPartyFor = (origin: string): { origin: string; rpID: string } => {
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new HttpError(
      400,
      "INVALID_APPROVAL_ORIGIN",
      "Passkey approval requires HTTPS",
    );
  }
  return { origin: url.origin, rpID: url.hostname };
};

export const evaluationApprovalOptions = async (
  clerkUserId: string,
  email: string,
  displayName: string,
  approvalId: string,
  origin: string,
  authenticator: ApprovalAuthenticator = "local-device",
  database?: EvaluationApprovalDatabase,
): Promise<{
  readonly kind: "registration" | "authentication";
  readonly options: unknown;
}> => {
  const client = await approvalDatabase(database);
  const approval = await approvalForParticipant(
    clerkUserId,
    approvalId,
    database,
  );
  if (!approval) {
    throw new HttpError(
      404,
      "EVALUATION_APPROVAL_NOT_FOUND",
      "Approval not found",
    );
  }
  activeApproval(approval);

  const passkeys = await client.execute<PasskeyRow>(sql`
    select "credential_id", "public_key", "counter", "transports"
    from "participant_passkeys"
    where "participant_id" = ${approval.participant_id}
    order by "created_at"
  `);
  const relyingParty = relyingPartyFor(origin);
  let kind: "registration" | "authentication";
  let options:
    | Awaited<ReturnType<typeof generateRegistrationOptions>>
    | Awaited<ReturnType<typeof generateAuthenticationOptions>>;
  if (passkeys.rows.length === 0) {
    kind = "registration";
    const preferences = registrationPreferences(authenticator);
    options = await generateRegistrationOptions({
      rpName: "Hack the Andes",
      rpID: relyingParty.rpID,
      userID: new TextEncoder().encode(approval.participant_id),
      userName: email,
      userDisplayName: displayName || email,
      timeout: ceremonyTimeoutMs,
      attestationType: "none",
      authenticatorSelection: preferences.authenticatorSelection,
      preferredAuthenticatorType: preferences.preferredAuthenticatorType,
    });
  } else {
    kind = "authentication";
    options = await generateAuthenticationOptions({
      rpID: relyingParty.rpID,
      timeout: ceremonyTimeoutMs,
      userVerification: "required",
      allowCredentials: passkeys.rows.map((passkey) => ({
        id: passkey.credential_id,
        transports: passkey.transports,
      })),
    });
  }

  const stored = await client.execute<IdentifierRow>(sql`
    update "challenge_evaluation_approvals"
    set
      "ceremony_challenge" = ${options.challenge},
      "ceremony_kind" = ${kind},
      "webauthn_origin" = ${relyingParty.origin},
      "relying_party_id" = ${relyingParty.rpID},
      "updated_at" = now()
    where
      "id" = ${approval.id}
      and "approved_at" is null
      and "consumed_at" is null
      and "expires_at" > now()
    returning "id"
  `);
  if (stored.rows.length !== 1) {
    throw new HttpError(
      409,
      "EVALUATION_APPROVAL_CHANGED",
      "The approval changed before passkey verification began",
    );
  }
  return { kind, options };
};

const invalidVerification = (): HttpError =>
  new HttpError(
    422,
    "HUMAN_VERIFICATION_FAILED",
    "Passkey user verification failed",
  );

const verifiedRegistration = async (
  client: EvaluationApprovalDatabase,
  approval: ApprovalRow,
  response: RegistrationResponseJSON,
): Promise<void> => {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: approval.ceremony_challenge ?? "",
    expectedOrigin: approval.webauthn_origin ?? "",
    expectedRPID: approval.relying_party_id ?? "",
    requireUserPresence: true,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo.userVerified) {
    throw invalidVerification();
  }
  const { registrationInfo } = verification;
  const credential = registrationInfo.credential;
  const publicKey = Buffer.from(credential.publicKey).toString("base64url");
  const result = await client.execute<IdentifierRow>(sql`
    with stored_credential as (
      insert into "participant_passkeys" (
        "participant_id",
        "credential_id",
        "public_key",
        "counter",
        "transports",
        "device_type",
        "backed_up"
      ) values (
        ${approval.participant_id},
        ${credential.id},
        ${publicKey},
        ${credential.counter},
        ${JSON.stringify(credential.transports ?? [])}::jsonb,
        ${registrationInfo.credentialDeviceType},
        ${registrationInfo.credentialBackedUp}
      )
      on conflict ("credential_id") do nothing
      returning "credential_id"
    )
    update "challenge_evaluation_approvals"
    set
      "approved_at" = now(),
      "credential_id" = stored_credential."credential_id",
      "ceremony_challenge" = null,
      "updated_at" = now()
    from stored_credential
    where
      "id" = ${approval.id}
      and "approved_at" is null
      and "consumed_at" is null
      and "expires_at" > now()
    returning "id"
  `);
  if (result.rows.length !== 1) throw invalidVerification();
};

const verifiedAuthentication = async (
  client: EvaluationApprovalDatabase,
  approval: ApprovalRow,
  response: AuthenticationResponseJSON,
): Promise<void> => {
  const passkeys = await client.execute<PasskeyRow>(sql`
    select "credential_id", "public_key", "counter", "transports"
    from "participant_passkeys"
    where
      "participant_id" = ${approval.participant_id}
      and "credential_id" = ${response.id}
    limit 1
  `);
  const passkey = passkeys.rows[0];
  if (!passkey) throw invalidVerification();
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: approval.ceremony_challenge ?? "",
    expectedOrigin: approval.webauthn_origin ?? "",
    expectedRPID: approval.relying_party_id ?? "",
    credential: {
      id: passkey.credential_id,
      publicKey: Uint8Array.from(Buffer.from(passkey.public_key, "base64url")),
      counter: Number(passkey.counter),
      transports: passkey.transports,
    },
    requireUserVerification: true,
    advancedFIDOConfig: { userVerification: "required" },
  });
  if (!verification.verified || !verification.authenticationInfo.userVerified) {
    throw invalidVerification();
  }
  const result = await client.execute<IdentifierRow>(sql`
    with updated_credential as (
      update "participant_passkeys"
      set
        "counter" = ${verification.authenticationInfo.newCounter},
        "backed_up" = ${verification.authenticationInfo.credentialBackedUp},
        "device_type" = ${verification.authenticationInfo.credentialDeviceType},
        "updated_at" = now()
      where
        "participant_id" = ${approval.participant_id}
        and "credential_id" = ${passkey.credential_id}
      returning "credential_id"
    )
    update "challenge_evaluation_approvals"
    set
      "approved_at" = now(),
      "credential_id" = updated_credential."credential_id",
      "ceremony_challenge" = null,
      "updated_at" = now()
    from updated_credential
    where
      "id" = ${approval.id}
      and "approved_at" is null
      and "consumed_at" is null
      and "expires_at" > now()
    returning "id"
  `);
  if (result.rows.length !== 1) throw invalidVerification();
};

export const verifyEvaluationApproval = async (
  clerkUserId: string,
  approvalId: string,
  response: unknown,
  database?: EvaluationApprovalDatabase,
): Promise<EvaluationApprovalView> => {
  const client = await approvalDatabase(database);
  const approval = await approvalForParticipant(
    clerkUserId,
    approvalId,
    database,
  );
  if (!approval) {
    throw new HttpError(
      404,
      "EVALUATION_APPROVAL_NOT_FOUND",
      "Approval not found",
    );
  }
  activeApproval(approval);
  if (
    !approval.ceremony_challenge ||
    !approval.webauthn_origin ||
    !approval.relying_party_id
  ) {
    throw new HttpError(
      409,
      "APPROVAL_CEREMONY_REQUIRED",
      "Request passkey options before verifying approval",
    );
  }
  try {
    if (approval.ceremony_kind === "registration") {
      await verifiedRegistration(
        client,
        approval,
        response as RegistrationResponseJSON,
      );
    } else if (approval.ceremony_kind === "authentication") {
      await verifiedAuthentication(
        client,
        approval,
        response as AuthenticationResponseJSON,
      );
    } else {
      throw new Error("Unsupported approval ceremony");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("Evaluation approval verification failed", error);
    throw invalidVerification();
  }
  const verified = await approvalForParticipant(
    clerkUserId,
    approvalId,
    database,
  );
  if (!verified?.approved_at) throw invalidVerification();
  return toView(verified);
};
