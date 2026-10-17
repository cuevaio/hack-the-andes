import { parseEventInput } from "@/lib/event/database";
import { requireJudgingIdentity } from "@/lib/judging/auth";
import { GrantJudgeSchema, JudgeActiveSchema } from "@/lib/judging/contract";
import { grantJudge, setJudgeActive } from "@/lib/judging/service";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";
export const POST = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    await requireJudgingIdentity("admin");
    const input = parseEventInput(GrantJudgeSchema, await readJson(request));
    return jsonSuccess(requestId, await grantJudge(input.email));
  });
export const PATCH = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    await requireJudgingIdentity("admin");
    const input = parseEventInput(JudgeActiveSchema, await readJson(request));
    return jsonSuccess(
      requestId,
      await setJudgeActive(input.clerkUserId, input.active),
    );
  });
