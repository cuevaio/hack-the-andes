import { requireParticipantUserId } from "@/lib/auth";
import { testChallengeSolution } from "@/lib/challenges/service";
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
    const result = await testChallengeSolution(
      clerkUserId,
      slug,
      await readJson(request),
    );
    const applicationId = await challengeReminderApplicationIdFor(clerkUserId);
    await enqueueChallengeFinishReminderBestEffort(
      clerkUserId,
      applicationId,
      slug,
    );
    await captureProductEvent({
      distinctId: clerkUserId,
      event: "challenge_local_test_completed",
      request,
      properties: {
        challenge_slug: slug,
        accuracy: result.accuracy,
        observation_count: result.observationCount,
      },
    });
    return jsonSuccess(requestId, result);
  });
