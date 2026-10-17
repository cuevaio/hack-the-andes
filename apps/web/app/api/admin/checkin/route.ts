import { Schema } from "effect";
import { requireAdminIdentity } from "@/lib/admin/auth";
import {
  CheckinConfirmationInputSchema,
  CheckinSearchSchema,
} from "@/lib/admin/checkin-contract";
import {
  confirmParticipantArrival,
  getCheckinRoster,
} from "@/lib/admin/checkin-service";
import { parseEventInput } from "@/lib/event/database";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";
import { adminCheckin } from "@/lib/teams/service";

export const runtime = "nodejs";
export const GET = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    await requireAdminIdentity();
    return jsonSuccess(requestId, await getCheckinRoster());
  });
// Search terms and bearer codes stay in POST bodies rather than URLs.
export const POST = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const admin = await requireAdminIdentity();
    const input = parseEventInput(
      Schema.Union([
        CheckinSearchSchema,
        Schema.Struct({ token: Schema.String, confirm: Schema.Boolean }),
      ]),
      await readJson(request),
    );
    if ("search" in input)
      return jsonSuccess(requestId, await getCheckinRoster(input.search));
    return jsonSuccess(
      requestId,
      await adminCheckin(admin.clerkUserId, input.token, input.confirm),
    );
  });
export const PATCH = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const admin = await requireAdminIdentity();
    const input = parseEventInput(
      CheckinConfirmationInputSchema,
      await readJson(request),
    );
    return jsonSuccess(
      requestId,
      await confirmParticipantArrival(admin.clerkUserId, input.applicationId),
    );
  });
