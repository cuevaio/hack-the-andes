import { redirect } from "next/navigation";
import { EventControl } from "@/components/event-control";
import { getAdminIdentity } from "@/lib/admin/auth";
import { getProjectDashboard } from "@/lib/projects/service";
import { getTeamDashboard } from "@/lib/teams/service";

export const dynamic = "force-dynamic";
export default async function EventPage() {
  if (!(await getAdminIdentity()))
    redirect("/sign-in?redirect_url=/admin/event");
  const [teams, projects] = await Promise.all([
    getTeamDashboard(),
    getProjectDashboard(),
  ]);
  return <EventControl initialData={teams} initialProjects={projects} />;
}
