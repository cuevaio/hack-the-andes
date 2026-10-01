import { requireAuthenticatedParticipantProfile } from "@/lib/auth";
import { enqueueFunnelReminderBestEffort } from "@/lib/funnel-reminders/enqueue";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";
import { participantIdFor } from "@/lib/registration/participants";

export const runtime = "nodejs";

export const GET = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const authentication =
      await requireAuthenticatedParticipantProfile(request);
    await participantIdFor(authentication.clerkUserId, authentication.name);
    if (!authentication.canReviewApplications) {
      await enqueueFunnelReminderBestEffort({
        clerkUserId: authentication.clerkUserId,
        stage: "registration",
        recipient: {
          email: authentication.email,
          firstName: authentication.firstName,
        },
      });
    }
    return jsonSuccess(requestId, {
      authenticated: true as const,
      userId: authentication.clerkUserId,
      email: authentication.email,
      tokenType: authentication.tokenType,
      clerkPictureUrl: authentication.clerkPictureUrl,
    });
  });
