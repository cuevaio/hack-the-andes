import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ParticipantInsights } from "@/components/participant-insights";
import { getAdminIdentity } from "@/lib/admin/auth";
import { parseCandidateFilters } from "@/lib/admin/candidate-filters";
import { getAdminInsights } from "@/lib/admin/insights";

export const dynamic = "force-dynamic";

export default async function InsightsAdminPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authentication = await auth();
  if (!authentication.userId) redirect("/sign-in?redirect_url=/admin/insights");
  const admin = await getAdminIdentity();
  if (!admin) redirect("/welcome");

  const { country, challenge } = parseCandidateFilters(await searchParams);
  const filters = { country, challenge };
  const data = await getAdminInsights(filters);
  return <ParticipantInsights data={data} filters={filters} />;
}
