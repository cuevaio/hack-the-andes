import { createHash, randomBytes } from "node:crypto";
import { type SQL, sql } from "@chofex/db/orm";
import {
  CheckinPreviewSchema,
  CheckinSchema,
  TeamActionSchema,
  TeamDashboardSchema,
  TeamStateSchema,
} from "@chofex/registration-contract";
import { clerkClient } from "@clerk/nextjs/server";
import { Schema } from "effect";
import { HttpError } from "@/lib/registration/http";

export function parseTeamInput<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown,
): S["Type"] {
  try {
    return Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(
      input,
    );
  } catch {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Revisa los datos de la operación.",
    );
  }
}

async function query(statement: SQL): Promise<unknown> {
  const { db } = await import("@chofex/db");
  const result = await db.execute(statement);
  const value = result.rows[0]?.result;
  if (value && typeof value === "object" && "error" in value) {
    const error = value.error as { code: string; message: string };
    let status = 409;
    if (error.code === "ADMIN_REQUIRED") status = 403;
    if (error.code === "VALIDATION_ERROR") status = 422;
    throw new HttpError(status, error.code, error.message);
  }
  return value;
}

async function participantFor(clerkUserId: string): Promise<string> {
  const result =
    await query(sql`select participant_id as result from hackathon_confirmed_participants
    where clerk_user_id=${clerkUserId}`);
  if (typeof result !== "string") {
    throw new HttpError(
      403,
      "CONFIRMATION_REQUIRED",
      "Necesitas una postulación aceptada y confirmar tu asistencia con andes confirm.",
    );
  }
  return result;
}

export async function getTeamState(clerkUserId: string) {
  const id = await participantFor(clerkUserId);
  return Schema.decodeUnknownSync(TeamStateSchema)(
    await query(sql`select hackathon_team_state(${id}::uuid) as result`),
  );
}

export async function teamAction(clerkUserId: string, input: unknown) {
  const command = parseTeamInput(TeamActionSchema, input);
  const id = await participantFor(clerkUserId);
  let internalCommand: unknown = command;
  if (command.action === "invite") {
    const email = command.email.toLowerCase();
    const clerk = await clerkClient();
    const users = await clerk.users.getUserList({
      emailAddress: [email],
      limit: 10,
    });
    const matches = users.data.filter((user) =>
      user.emailAddresses.some(
        (address) =>
          address.id === user.primaryEmailAddressId &&
          address.emailAddress.toLowerCase() === email &&
          address.verification?.status === "verified",
      ),
    );
    if (matches.length !== 1 || !matches[0]) {
      throw new HttpError(
        422,
        "INVITEE_NOT_ELIGIBLE",
        "Usa el correo principal de un participante aceptado con asistencia confirmada.",
      );
    }
    let inviteeId: string;
    try {
      inviteeId = await participantFor(matches[0].id);
    } catch (error) {
      if (
        !(error instanceof HttpError) ||
        error.code !== "CONFIRMATION_REQUIRED"
      )
        throw error;
      throw new HttpError(
        422,
        "INVITEE_NOT_ELIGIBLE",
        "Usa el correo principal de un participante aceptado con asistencia confirmada.",
      );
    }
    internalCommand = { action: "invite", inviteeId };
  }
  return Schema.decodeUnknownSync(TeamStateSchema)(
    await query(
      sql`select hackathon_action(${id}::uuid, ${JSON.stringify(internalCommand)}::jsonb) as result`,
    ),
  );
}

export async function getTeamDashboard() {
  return Schema.decodeUnknownSync(TeamDashboardSchema)(
    await query(sql`select hackathon_team_dashboard() as result`),
  );
}

export async function setTrackSelection(
  adminId: string,
  selectionOpen: boolean,
) {
  const command = JSON.stringify({ action: "settings", selectionOpen });
  return Schema.decodeUnknownSync(TeamDashboardSchema)(
    await query(
      sql`select hackathon_action(null, ${command}::jsonb, ${adminId}) as result`,
    ),
  );
}

export const checkinTokenHash = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export async function issueCheckin(clerkUserId: string) {
  const id = await participantFor(clerkUserId);
  const token = randomBytes(16).toString("hex");
  const command = JSON.stringify({
    action: "checkin",
    tokenHash: checkinTokenHash(token),
  });
  const result = Schema.decodeUnknownSync(CheckinSchema)(
    await query(
      sql`select hackathon_action(${id}::uuid, ${command}::jsonb) as result`,
    ),
  );
  if (result.checkedIn) return result;
  return { ...result, token };
}

export async function adminCheckin(
  adminId: string,
  token: string,
  confirm: boolean,
) {
  const normalized = token.replace(/[\s-]/g, "").toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(normalized))
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Código de check-in inválido.",
    );
  let action = "checkin-preview";
  if (confirm) action = "checkin-confirm";
  const command = JSON.stringify({
    action,
    tokenHash: checkinTokenHash(normalized),
  });
  return Schema.decodeUnknownSync(CheckinPreviewSchema)(
    await query(
      sql`select hackathon_action(null, ${command}::jsonb, ${adminId}) as result`,
    ),
  );
}
