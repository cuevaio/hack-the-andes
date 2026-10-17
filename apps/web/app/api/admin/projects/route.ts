import { Schema } from "effect";
import { requireAdminIdentity } from "@/lib/admin/auth";
import { parseEventInput } from "@/lib/event/database";
import {
  getProjectDashboard,
  setProjectGalleryVisibility,
} from "@/lib/projects/service";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";
export const GET = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    await requireAdminIdentity();
    return jsonSuccess(requestId, await getProjectDashboard());
  });
export const PATCH = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const admin = await requireAdminIdentity();
    const input = parseEventInput(
      Schema.Struct({ galleryVisible: Schema.Boolean }),
      await readJson(request),
    );
    return jsonSuccess(
      requestId,
      await setProjectGalleryVisibility(
        admin.clerkUserId,
        input.galleryVisible,
      ),
    );
  });
