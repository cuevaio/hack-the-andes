import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChallengesShell } from "@/components/challenges/challenges-shell";
import { SlowServiceApprovalView } from "@/components/challenges/slow-service-approval-view";
import { evaluationApprovalForParticipant } from "@/lib/challenges/evaluation-approvals";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Aprobar The Slow Service | Hack the Andes",
  robots: { index: false, follow: false },
};

export default async function SlowServiceApprovalPage({
  params,
}: {
  readonly params: Promise<{ approvalId: string }>;
}) {
  const { approvalId } = await params;
  const authentication = await auth();
  if (!authentication.userId) {
    const returnPath = `/challenges/make-it-fast/approve/${approvalId}`;
    return (
      <ChallengesShell>
        <section className="mx-auto max-w-2xl space-y-6 px-6 py-20">
          <h1>Inicia sesión para revisar la evaluación</h1>
          <p>La sesión del CLI no puede aprobar el envío.</p>
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(returnPath)}`}
          >
            Iniciar sesión
          </Link>
        </section>
      </ChallengesShell>
    );
  }
  const approval = await evaluationApprovalForParticipant(
    authentication.userId,
    approvalId,
    undefined,
    "slow-service-v3",
  );
  if (!approval || !("challengeSlug" in approval.review)) notFound();
  return (
    <ChallengesShell>
      <SlowServiceApprovalView
        id={approval.id}
        snapshot={approval.review}
        expiresAt={approval.expiresAt}
        approvedAt={approval.approvedAt}
        consumedAt={approval.consumedAt}
      />
    </ChallengesShell>
  );
}
