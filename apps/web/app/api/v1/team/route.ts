import { requireAuthenticatedParticipant } from "@/lib/auth";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";
import { getTeamState, teamAction } from "@/lib/teams/service";

export const runtime = "nodejs";
export const GET = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipant(request);
    return jsonSuccess(requestId, await getTeamState(participant.clerkUserId));
  });
export const POST = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipant(request);
    return jsonSuccess(
      requestId,
      await teamAction(participant.clerkUserId, await readJson(request)),
    );
  });
