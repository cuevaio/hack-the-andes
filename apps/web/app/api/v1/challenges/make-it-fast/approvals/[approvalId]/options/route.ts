import { requireBrowserParticipantProfile } from "@/lib/auth";
import {
  evaluationApprovalOptions,
  parseApprovalAuthenticator,
} from "@/lib/challenges/evaluation-approvals";
import { publicRequestOrigin } from "@/lib/public-origin";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";
export const POST = (
  request: Request,
  context: { params: Promise<{ approvalId: string }> },
): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireBrowserParticipantProfile(request);
    const { approvalId } = await context.params;
    const body = await readJson(request);
    let authenticator = parseApprovalAuthenticator("local-device");
    if (body && typeof body === "object" && "authenticator" in body)
      authenticator = parseApprovalAuthenticator(body.authenticator);
    const result = await evaluationApprovalOptions(
      participant.clerkUserId,
      participant.email,
      participant.name,
      approvalId,
      publicRequestOrigin(request),
      authenticator,
      undefined,
      "slow-service-v3",
    );
    return jsonSuccess(requestId, result);
  });
