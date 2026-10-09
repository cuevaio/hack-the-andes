import { getPublicChallengeRanking } from "@/lib/challenges/public-ranking";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";

export const GET = (
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const { slug } = await context.params;
    return jsonSuccess(requestId, await getPublicChallengeRanking(slug));
  });
