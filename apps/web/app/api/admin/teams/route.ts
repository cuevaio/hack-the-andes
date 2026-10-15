import { Schema } from "effect";
import { requireAdminIdentity } from "@/lib/admin/auth";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";
import {
  getTeamDashboard,
  parseTeamInput,
  setTrackSelection,
} from "@/lib/teams/service";

export const runtime = "nodejs";
export const GET = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    await requireAdminIdentity();
    return jsonSuccess(requestId, await getTeamDashboard());
  });
export const PATCH = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const admin = await requireAdminIdentity();
    const input = parseTeamInput(
      Schema.Struct({ selectionOpen: Schema.Boolean }),
      await readJson(request),
    );
    return jsonSuccess(
      requestId,
      await setTrackSelection(admin.clerkUserId, input.selectionOpen),
    );
  });
