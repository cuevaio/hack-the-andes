import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { configuredAdminIdsFrom } from "@/lib/admin/roles";
import { HttpError } from "@/lib/registration/http";
import { hasJudgingRole } from "./roles";

export async function getJudgingIdentity(role: "admin" | "judge") {
  const { userId } = await auth();
  if (!userId) return null;
  if (
    role === "admin" &&
    configuredAdminIdsFrom(process.env.ADMIN_CLERK_USER_IDS).has(userId)
  )
    return { clerkUserId: userId };
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  if (!hasJudgingRole(user.publicMetadata, user.privateMetadata, role))
    return null;
  return { clerkUserId: userId };
}
export async function requireJudgingIdentity(role: "admin" | "judge") {
  const identity = await getJudgingIdentity(role);
  if (!identity)
    throw new HttpError(
      403,
      "JUDGING_ACCESS_REQUIRED",
      "No tienes acceso a esta sección.",
    );
  return identity;
}
