import { parseEventInput } from "@/lib/event/database";
import { requireJudgingIdentity } from "@/lib/judging/auth";
import { EvaluationCommandSchema } from "@/lib/judging/contract";
import { getJudgeBoard, saveEvaluation } from "@/lib/judging/service";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";
export const GET = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const judge = await requireJudgingIdentity("judge");
    const history = new URL(request.url).searchParams.get("history") === "1";
    return jsonSuccess(
      requestId,
      await getJudgeBoard(judge.clerkUserId, history),
    );
  });
export const PATCH = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const judge = await requireJudgingIdentity("judge");
    const command = parseEventInput(
      EvaluationCommandSchema,
      await readJson(request),
    );
    return jsonSuccess(
      requestId,
      await saveEvaluation(
        judge.clerkUserId,
        command,
        new URL(request.url).searchParams.get("history") === "1",
      ),
    );
  });
