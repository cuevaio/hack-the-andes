import { requireAuthenticatedParticipant } from "@/lib/auth";
import { getParticipantCredits } from "@/lib/credits/service";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";
export const GET = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipant(request);
    const credits = await getParticipantCredits(participant.clerkUserId);
    return jsonSuccess(requestId, credits);
  });
