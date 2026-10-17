import { redirect } from "next/navigation";

import { getAdminIdentity } from "@/lib/admin/auth";
import { getJudgingIdentity } from "@/lib/judging/auth";

export const dynamic = "force-dynamic";

export default async function AuthenticationCompletePage() {
  const admin = await getAdminIdentity();
  if (admin) redirect("/admin/participants");

  if (await getJudgingIdentity("judge")) redirect("/judging");

  redirect("/welcome");
}
