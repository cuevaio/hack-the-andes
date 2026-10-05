import { handleAdminPreview } from "@/lib/challenges/admin-preview";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";
export const runtime = "nodejs";
export const POST = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) =>
    jsonSuccess(
      requestId,
      await handleAdminPreview(request, await readJson(request)),
    ),
  );
