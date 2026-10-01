import { requireParticipantUserId } from "@/lib/auth";
import { queryChallenge } from "@/lib/challenges/service";
import {
  challengeReminderApplicationIdFor,
  enqueueChallengeFinishReminderBestEffort,
} from "@/lib/funnel-reminders/enqueue";
import { captureProductEvent } from "@/lib/posthog-server";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";

export const POST = (
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const { slug } = await context.params;
    const clerkUserId = await requireParticipantUserId(request);
    const applicationId = await challengeReminderApplicationIdFor(clerkUserId);
    const result = await queryChallenge(
      clerkUserId,
      slug,
      await readJson(request),
    );
    await enqueueChallengeFinishReminderBestEffort(
      clerkUserId,
      applicationId,
      slug,
    );
    await captureProductEvent({
      distinctId: clerkUserId,
      event: "challenge_query_completed",
      request,
      properties: {
        challenge_slug: slug,
        queries_used: result.queriesUsed,
        queries_remaining: result.queriesRemaining,
      },
    });
    return jsonSuccess(requestId, result);
  });
