import { requireParticipantUserId } from "@/lib/auth";
import { getChallengeAttempt } from "@/lib/challenges/service";
import { enqueueChallengeFinishReminderBestEffort } from "@/lib/funnel-reminders/enqueue";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";

export const GET = (
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const { slug } = await context.params;
    const clerkUserId = await requireParticipantUserId(request);
    const result = await getChallengeAttempt(clerkUserId, slug);
    if (result.progress.status === "in_progress") {
      await enqueueChallengeFinishReminderBestEffort(clerkUserId, slug);
    }
    return jsonSuccess(requestId, result);
  });
