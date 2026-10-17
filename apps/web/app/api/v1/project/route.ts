import { requireAuthenticatedParticipant } from "@/lib/auth";
import { getProjectState, projectAction } from "@/lib/projects/service";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";
export const runtime = "nodejs";
export const GET = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipant(request);
    return jsonSuccess(
      requestId,
      await getProjectState(
        participant.clerkUserId,
        new URL(request.url).searchParams.get("history") !== "false",
      ),
    );
  });
export const POST = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipant(request);
    return jsonSuccess(
      requestId,
      await projectAction(participant.clerkUserId, await readJson(request)),
    );
  });
