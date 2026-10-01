import { requireAuthenticatedParticipantProfile } from "@/lib/auth";
import { enqueuePostSubmissionRemindersBestEffort } from "@/lib/funnel-reminders/enqueue";
import { captureProductEvent } from "@/lib/posthog-server";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";
import { submitRegistration } from "@/lib/registration/service";

export const runtime = "nodejs";

export const POST = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipantProfile(request);
    const result = await submitRegistration({
      clerkUserId: participant.clerkUserId,
      email: participant.email,
      name: participant.name,
    });
    const challengeAlreadyStarted = result.registration.challenges.some(
      (challenge) =>
        challenge.playable &&
        challenge.open &&
        challenge.status === "in_progress",
    );
    await enqueuePostSubmissionRemindersBestEffort(
      participant.clerkUserId,
      result.registration.id,
      challengeAlreadyStarted,
    );
    await captureProductEvent({
      distinctId: participant.clerkUserId,
      event: "application_submitted",
      request,
      properties: {
        auth_token_type: participant.tokenType,
        application_status: result.registration.status,
      },
    });
    return jsonSuccess(requestId, result, 201);
  });
