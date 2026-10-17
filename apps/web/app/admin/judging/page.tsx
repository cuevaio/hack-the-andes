import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { JudgingControl } from "@/components/judging/judging-control";
import { getJudgingIdentity } from "@/lib/judging/auth";
import { getAdminBoard } from "@/lib/judging/service";

export const dynamic = "force-dynamic";
export default async function JudgingControlPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/admin/judging");
  const identity = await getJudgingIdentity("admin");
  if (!identity)
    return (
      <main className="mx-auto max-w-xl space-y-4 px-5 py-16">
        <h1 className="text-2xl font-semibold">Acceso de administración</h1>
        <p>Tu cuenta no tiene permisos para controlar las presentaciones.</p>
      </main>
    );
  return (
    <JudgingControl
      adminId={identity.clerkUserId}
      initialData={await getAdminBoard()}
    />
  );
}
