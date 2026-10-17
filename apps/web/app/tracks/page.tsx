import { redirect } from "next/navigation";
import { TeamDashboardView } from "@/components/team-dashboard";
import { getAdminIdentity } from "@/lib/admin/auth";
import { getTeamDashboard } from "@/lib/teams/service";

export const dynamic = "force-dynamic";
export default async function TracksPage() {
  if (!(await getAdminIdentity())) redirect("/sign-in?redirect_url=/tracks");
  const data = await getTeamDashboard();
  return <TeamDashboardView admin initialData={data} view="tracks" />;
}
