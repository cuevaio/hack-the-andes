import { createHash, randomBytes } from "node:crypto";
import { sql } from "@chofex/db/orm";
import {
  CheckinPreviewSchema,
  CheckinSchema,
  TeamActionSchema,
  TeamDashboardSchema,
  TeamStateSchema,
} from "@chofex/registration-contract";
import { clerkClient } from "@clerk/nextjs/server";
import { Schema } from "effect";
import {
  confirmedParticipantId,
  eventQuery,
  parseEventInput,
} from "@/lib/event/database";
import { HttpError } from "@/lib/registration/http";

export async function getTeamState(clerkUserId: string) {
  const id = await confirmedParticipantId(clerkUserId);
  return Schema.decodeUnknownSync(TeamStateSchema)(
    await eventQuery(sql`select hackathon_team_state(${id}::uuid) as result`),
  );
}

export async function teamAction(clerkUserId: string, input: unknown) {
  const command = parseEventInput(TeamActionSchema, input);
  const id = await confirmedParticipantId(clerkUserId);
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
      inviteeId = await confirmedParticipantId(matches[0].id);
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
    await eventQuery(
      sql`select hackathon_action(${id}::uuid, ${JSON.stringify(internalCommand)}::jsonb) as result`,
    ),
  );
}

export async function getTeamDashboard() {
  return Schema.decodeUnknownSync(TeamDashboardSchema)(
    await eventQuery(sql`select hackathon_team_dashboard() as result`),
  );
}

export async function setTrackSelection(
  adminId: string,
  selectionOpen: boolean,
) {
  const command = JSON.stringify({ action: "settings", selectionOpen });
  return Schema.decodeUnknownSync(TeamDashboardSchema)(
    await eventQuery(
      sql`select hackathon_action(null, ${command}::jsonb, ${adminId}) as result`,
    ),
  );
}

export const checkinTokenHash = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export async function issueCheckin(clerkUserId: string) {
  const id = await confirmedParticipantId(clerkUserId);
  const token = randomBytes(16).toString("hex");
  const command = JSON.stringify({
    action: "checkin",
    tokenHash: checkinTokenHash(token),
  });
  const result = Schema.decodeUnknownSync(CheckinSchema)(
    await eventQuery(
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
    await eventQuery(
      sql`select hackathon_action(null, ${command}::jsonb, ${adminId}) as result`,
    ),
  );
}
