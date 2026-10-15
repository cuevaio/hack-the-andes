import { requireAuthenticatedParticipant } from "@/lib/auth";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";
import { getTeamDashboard, getTeamState } from "@/lib/teams/service";

export const runtime = "nodejs";
export const GET = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipant(request);
    await getTeamState(participant.clerkUserId);
    return jsonSuccess(requestId, await getTeamDashboard());
  });
