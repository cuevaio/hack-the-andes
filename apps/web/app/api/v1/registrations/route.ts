import { requireAuthenticatedParticipantProfile } from "@/lib/auth";
import { enqueuePostSubmissionRemindersBestEffort } from "@/lib/funnel-reminders/enqueue";
import { captureProductEvent } from "@/lib/posthog-server";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";
import { createRegistration } from "@/lib/registration/service";

export const runtime = "nodejs";

export const POST = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipantProfile(request);
    const result = await createRegistration(
      {
        clerkUserId: participant.clerkUserId,
        email: participant.email,
        name: participant.name,
      },
      await readJson(request),
    );
    const created = result.registration.status === "submitted";
    if (created) {
      await enqueuePostSubmissionRemindersBestEffort(
        participant.clerkUserId,
        result.registration.id,
        result.registration.challenges,
      );
    }
    const event = created ? "application_submitted" : "application_draft_saved";
    await captureProductEvent({
      distinctId: participant.clerkUserId,
      event,
      request,
      properties: {
        auth_token_type: participant.tokenType,
        application_status: result.registration.status,
        missing_requirement_count: result.requirements.missing.length,
      },
    });
    return jsonSuccess(requestId, result, created ? 201 : 200);
  });
