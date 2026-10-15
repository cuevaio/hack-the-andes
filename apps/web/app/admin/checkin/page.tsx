import { redirect } from "next/navigation";
import { CheckinDesk } from "@/components/checkin-desk";
import { getAdminIdentity } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export default async function CheckinPage() {
  if (!(await getAdminIdentity()))
    redirect("/sign-in?redirect_url=/admin/checkin");
  return <CheckinDesk />;
}
