import { authenticateParticipant } from "@/lib/auth";
import {
  listParticipantChallenges,
  listPublicChallenges,
} from "@/lib/challenges/catalog";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";

export const GET = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await authenticateParticipant(request);
    if (!participant) return jsonSuccess(requestId, listPublicChallenges());
    return jsonSuccess(
      requestId,
      await listParticipantChallenges(participant.clerkUserId),
    );
  });
