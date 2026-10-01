import { requireAdminIdentity } from "@/lib/admin/auth";
import { parseCandidateFilters } from "@/lib/admin/candidate-filters";
import { listCandidates } from "@/lib/admin/candidates";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";

export const GET = async (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    await requireAdminIdentity();

    const parameters = new URL(request.url).searchParams;
    const candidates = await listCandidates(parseCandidateFilters(parameters));

    return jsonSuccess(requestId, candidates);
  });
