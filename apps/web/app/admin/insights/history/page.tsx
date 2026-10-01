import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ParticipantHistory } from "@/components/participant-history";
import { getAdminIdentity } from "@/lib/admin/auth";
import { parseHistoryQuery } from "@/lib/admin/history-query";
import { getParticipantHistory } from "@/lib/admin/participant-history";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evolución y meta de asistencia" };

export default async function ParticipantHistoryPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authentication = await auth();
  if (!authentication.userId)
    redirect("/sign-in?redirect_url=/admin/insights/history");
  if (!(await getAdminIdentity())) redirect("/welcome");
  const query = parseHistoryQuery(await searchParams);
  const data = await getParticipantHistory(query);
  return <ParticipantHistory data={data} query={query} />;
}
