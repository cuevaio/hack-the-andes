import { Schema } from "effect";
import { requireAdminIdentity } from "@/lib/admin/auth";
import { parseEventInput } from "@/lib/event/database";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";
import { adminCheckin } from "@/lib/teams/service";

export const runtime = "nodejs";
// Both preview and confirmation use POST so bearer codes never appear in logs/URLs.
export const POST = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const admin = await requireAdminIdentity();
    const input = parseEventInput(
      Schema.Struct({ token: Schema.String, confirm: Schema.Boolean }),
      await readJson(request),
    );
    return jsonSuccess(
      requestId,
      await adminCheckin(admin.clerkUserId, input.token, input.confirm),
    );
  });
