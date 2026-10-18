import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { JudgePanel } from "@/components/judging/judge-panel";
import { getJudgingIdentity } from "@/lib/judging/auth";
import { getJudgeBoard } from "@/lib/judging/service";
import { HttpError } from "@/lib/registration/http";

export const dynamic = "force-dynamic";
export default async function JudgingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/judging");
  const identity = await getJudgingIdentity("judge");
  if (identity) {
    try {
      const initialData = await getJudgeBoard(identity.clerkUserId, true);
      return (
        <JudgePanel judgeId={identity.clerkUserId} initialData={initialData} />
      );
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 403) throw error;
    }
  }
  return (
    <main className="mx-auto max-w-xl space-y-4 px-5 py-16">
      <h1 className="text-2xl font-semibold">Acceso para jurados</h1>
      <p>
        Tu cuenta no tiene acceso activo al panel. Pide a la organización que
        agregue tu correo como jurado.
      </p>
    </main>
  );
}
