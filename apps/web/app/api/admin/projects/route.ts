import { Schema } from "effect";
import { requireAdminIdentity } from "@/lib/admin/auth";
import { parseEventInput } from "@/lib/event/database";
import {
  getProjectDashboard,
  setProjectGalleryVisibility,
  setProjectSubmissionsOpen,
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
      Schema.Union([
        Schema.Struct({ galleryVisible: Schema.Boolean }),
        Schema.Struct({ submissionsOpen: Schema.Boolean }),
      ]),
      await readJson(request),
    );
    if ("submissionsOpen" in input) {
      return jsonSuccess(
        requestId,
        await setProjectSubmissionsOpen(
          admin.clerkUserId,
          input.submissionsOpen,
        ),
      );
    }
    return jsonSuccess(
      requestId,
      await setProjectGalleryVisibility(
        admin.clerkUserId,
        input.galleryVisible,
      ),
    );
  });
