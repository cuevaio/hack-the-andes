import { getChallengeRanking } from "@/lib/challenges/ranking";
import { createPublicRankingCache } from "@/lib/challenges/ranking-cache";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";

const getPublicRanking = createPublicRankingCache({
  load: getChallengeRanking,
});

export const GET = (
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const { slug } = await context.params;
    return jsonSuccess(requestId, await getPublicRanking(slug));
  });
