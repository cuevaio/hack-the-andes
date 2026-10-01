import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { CandidateDashboard } from "@/components/candidate-dashboard";
import { getAdminIdentity } from "@/lib/admin/auth";
import { parseCandidateFilters } from "@/lib/admin/candidate-filters";
import { listCandidates } from "@/lib/admin/candidates";

export const dynamic = "force-dynamic";

interface HomeProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ParticipantsAdminPage({
  searchParams,
}: HomeProps) {
  const authentication = await auth();
  if (!authentication.userId) {
    redirect("/sign-in?redirect_url=/admin/participants");
  }

  const admin = await getAdminIdentity();
  if (!admin) redirect("/welcome");

  const parameters = await searchParams;
  const filters = parseCandidateFilters(parameters);
  const data = await listCandidates(filters);
  let selection: "first" | "last" | undefined;
  if (parameters.candidate === "first" || parameters.candidate === "last") {
    selection = parameters.candidate;
  }

  return (
    <CandidateDashboard
      key={`${JSON.stringify(filters)}:${selection ?? "none"}`}
      data={data}
      initialFilters={filters}
      initialSelection={selection}
    />
  );
}
