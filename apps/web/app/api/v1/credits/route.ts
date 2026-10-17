import { requireAuthenticatedParticipant } from "@/lib/auth";
import { creditsForCheckin } from "@/lib/credits/catalog";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";
import { getTeamState } from "@/lib/teams/service";

export const runtime = "nodejs";
export const GET = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipant(request);
    const state = await getTeamState(participant.clerkUserId);
    return jsonSuccess(requestId, creditsForCheckin(state.checkedIn));
  });
