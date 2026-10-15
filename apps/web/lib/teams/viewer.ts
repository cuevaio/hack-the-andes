import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAdminIdentity } from "@/lib/admin/auth";
import { HttpError } from "@/lib/registration/http";
import { getTeamDashboard, getTeamState } from "./service";

export async function teamDashboardViewer(path: string) {
  const authentication = await auth();
  if (!authentication.userId)
    redirect(`/sign-in?redirect_url=${encodeURIComponent(path)}`);
  const admin = await getAdminIdentity();
  if (!admin) {
    try {
      await getTeamState(authentication.userId);
    } catch (error) {
      if (error instanceof HttpError && error.code === "CONFIRMATION_REQUIRED")
        redirect("/welcome");
      throw error;
    }
  }
  return { admin: Boolean(admin), data: await getTeamDashboard() };
}
