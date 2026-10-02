import { requireBrowserParticipantProfile } from "@/lib/auth";
import { verifyEvaluationApproval } from "@/lib/challenges/evaluation-approvals";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";
export const POST = (
  request: Request,
  context: { params: Promise<{ approvalId: string }> },
): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireBrowserParticipantProfile(request);
    const { approvalId } = await context.params;
    const result = await verifyEvaluationApproval(
      participant.clerkUserId,
      approvalId,
      await readJson(request),
      undefined,
      "slow-service-v3",
    );
    return jsonSuccess(requestId, result);
  });
