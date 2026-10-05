import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PowerGridAdminPreview } from "@/components/challenges/power-grid-admin-preview";
import { getAdminIdentity } from "@/lib/admin/auth";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Prueba privada del challenge 4",
  robots: { index: false, follow: false },
};
export default async function PowerGridAdminPage() {
  const identity = await auth();
  if (!identity.userId)
    redirect("/sign-in?redirect_url=/admin/challenges/power-grid");
  if (!(await getAdminIdentity())) redirect("/welcome");
  return <PowerGridAdminPreview />;
}
