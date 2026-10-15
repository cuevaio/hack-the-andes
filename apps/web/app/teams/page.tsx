import { TeamDashboardView } from "@/components/team-dashboard";
import { teamDashboardViewer } from "@/lib/teams/viewer";

export const dynamic = "force-dynamic";
export default async function TeamsPage() {
  const { admin, data } = await teamDashboardViewer("/teams");
  return <TeamDashboardView admin={admin} initialData={data} view="teams" />;
}
