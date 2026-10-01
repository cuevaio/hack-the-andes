import { requireParticipantUserId } from "@/lib/auth";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";
import { selectRegistrationCountry } from "@/lib/registration/service";

export const runtime = "nodejs";

export const PUT = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const clerkUserId = await requireParticipantUserId(request);
    const result = await selectRegistrationCountry(
      clerkUserId,
      await readJson(request),
    );
    return jsonSuccess(requestId, result);
  });
