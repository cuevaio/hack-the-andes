import { requireParticipantUserId } from "@/lib/auth";
import { evaluateChallenge } from "@/lib/challenges/service";
import {
  challengeReminderApplicationIdFor,
  enqueueChallengeFinishReminderBestEffort,
} from "@/lib/funnel-reminders/enqueue";
import { captureProductEvent } from "@/lib/posthog-server";
import { publicRequestOrigin } from "@/lib/public-origin";
import {
  HttpError,
  jsonSuccess,
  readJson,
  withApiHandler,
} from "@/lib/registration/http";

export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = (
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const { slug } = await context.params;
    const clerkUserId = await requireParticipantUserId(request);
    const applicationId = await challengeReminderApplicationIdFor(clerkUserId);
    const input = await readJson(request);
    let result: Awaited<ReturnType<typeof evaluateChallenge>>;
    try {
      result = await evaluateChallenge(
        clerkUserId,
        slug,
        input,
        undefined,
        publicRequestOrigin(request),
      );
    } catch (error) {
      if (
        error instanceof HttpError &&
        (error.code === "SOLUTION_EXECUTION_FAILED" ||
          error.code === "HUMAN_APPROVAL_REQUIRED")
      ) {
        await enqueueChallengeFinishReminderBestEffort(
          clerkUserId,
          applicationId,
          slug,
        );
      }
      throw error;
    }
    await captureProductEvent({
      distinctId: clerkUserId,
      event: "challenge_evaluation_submitted",
      request,
      properties: {
        challenge_slug: slug,
        accuracy: result.accuracy,
        exact_count: result.exactCount,
        evaluations_used: result.evaluationsUsed,
        evaluations_remaining: result.evaluationsRemaining,
        rank: result.rank,
      },
    });
    return jsonSuccess(requestId, result);
  });
