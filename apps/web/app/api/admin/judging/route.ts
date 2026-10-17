import { parseEventInput } from "@/lib/event/database";
import { requireJudgingIdentity } from "@/lib/judging/auth";
import { AdminCommandSchema } from "@/lib/judging/contract";
import { adminJudgingAction, getAdminBoard } from "@/lib/judging/service";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";
export const GET = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    await requireJudgingIdentity("admin");
    return jsonSuccess(requestId, await getAdminBoard());
  });
export const PATCH = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const admin = await requireJudgingIdentity("admin");
    const command = parseEventInput(
      AdminCommandSchema,
      await readJson(request),
    );
    return jsonSuccess(
      requestId,
      await adminJudgingAction(admin.clerkUserId, command),
    );
  });
