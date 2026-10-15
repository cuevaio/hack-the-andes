import { requireAuthenticatedParticipant } from "@/lib/auth";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";
import { getTeamState, issueCheckin } from "@/lib/teams/service";

export const runtime = "nodejs";
export const GET = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipant(request);
    const state = await getTeamState(participant.clerkUserId);
    return jsonSuccess(requestId, { checkedIn: state.checkedIn });
  });
export const POST = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipant(request);
    return jsonSuccess(requestId, await issueCheckin(participant.clerkUserId));
  });
