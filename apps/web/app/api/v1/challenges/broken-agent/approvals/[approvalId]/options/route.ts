import { requireBrowserParticipantProfile } from "@/lib/auth";
import {
  type ApprovalAuthenticator,
  evaluationApprovalOptions,
  parseApprovalAuthenticator,
} from "@/lib/challenges/evaluation-approvals";
import { publicRequestOrigin } from "@/lib/public-origin";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";

const authenticatorFrom = async (
  request: Request,
): Promise<ApprovalAuthenticator> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return "local-device";
  }
  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return parseApprovalAuthenticator(undefined);
  }
  const authenticator = (body as { readonly authenticator?: unknown })
    .authenticator;
  if (authenticator === undefined) return "local-device";
  return parseApprovalAuthenticator(authenticator);
};

export const POST = (
  request: Request,
  context: { params: Promise<{ approvalId: string }> },
): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireBrowserParticipantProfile(request);
    const { approvalId } = await context.params;
    const result = await evaluationApprovalOptions(
      participant.clerkUserId,
      participant.email,
      participant.name,
      approvalId,
      publicRequestOrigin(request),
      await authenticatorFrom(request),
    );
    return jsonSuccess(requestId, result);
  });
