import { TeamDashboardView } from "@/components/team-dashboard";
import { teamDashboardViewer } from "@/lib/teams/viewer";

export const dynamic = "force-dynamic";
export default async function TracksPage() {
  const { admin, data } = await teamDashboardViewer("/tracks");
  return <TeamDashboardView admin={admin} initialData={data} view="tracks" />;
}
