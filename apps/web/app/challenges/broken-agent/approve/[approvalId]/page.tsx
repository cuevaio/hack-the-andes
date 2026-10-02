import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChallengesShell } from "@/components/challenges/challenges-shell";
import { EvaluationApprovalButton } from "@/components/challenges/evaluation-approval-button";
import { evaluationApprovalForParticipant } from "@/lib/challenges/evaluation-approvals";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aprobar evaluación | Hack the Andes",
  robots: { index: false, follow: false },
};

const focusLabels = {
  concurrency: "Concurrencia",
  persistence: "Persistencia",
  lease_recovery: "Recuperación de leases",
  retry_idempotency: "Reintentos e idempotencia",
  regression_safety: "Seguridad contra regresiones",
  performance: "Rendimiento",
} as const;

export default async function EvaluationApprovalPage({
  params,
}: {
  readonly params: Promise<{ approvalId: string }>;
}) {
  const { approvalId } = await params;
  const authentication = await auth();
  if (!authentication.userId) {
    const returnPath = `/challenges/broken-agent/approve/${approvalId}`;
    return (
      <ChallengesShell>
        <section className="mx-auto max-w-2xl space-y-6 px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--hud-accent)]">
            Verificación del participante
          </p>
          <h1 className="text-3xl font-semibold text-[var(--hud-ink)]">
            Inicia sesión para revisar la evaluación
          </h1>
          <p className="text-[var(--hud-muted)]">
            La sesión del CLI no puede aprobar una evaluación oficial. Esta
            revisión pertenece al participante.
          </p>
          <Link
            className="underline underline-offset-4"
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
  );
  if (!approval) notFound();

  const expired = Date.parse(approval.expiresAt) <= Date.now();
  const review = approval.review;
  if ("challengeSlug" in review) notFound();
  let action: React.ReactNode;
  if (approval.consumedAt && approval.approvedAt) {
    action = (
      <p className="text-sm text-[var(--hud-muted)]">
        Esta aprobación ya fue usada. Cada evaluación oficial requiere una
        intervención nueva.
      </p>
    );
  } else if (approval.approvedAt) {
    action = (
      <p className="text-sm text-[var(--hud-muted)]">
        Aprobación confirmada. Vuelve al terminal y repite el comando de
        evaluación.
      </p>
    );
  } else if (expired || approval.consumedAt) {
    action = (
      <p className="text-sm text-[var(--hud-muted)]">
        Esta aprobación venció. Repite el comando de evaluación para generar una
        nueva.
      </p>
    );
  } else {
    action = <EvaluationApprovalButton approvalId={approval.id} />;
  }

  return (
    <ChallengesShell>
      <section className="mx-auto max-w-3xl space-y-8 px-6 py-16">
        <header className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--hud-accent)]">
            Broken Agent · evaluación oficial
          </p>
          <h1 className="text-3xl font-semibold text-[var(--hud-ink)]">
            Revisa tu decisión de ingeniería
          </h1>
          <p className="max-w-2xl leading-relaxed text-[var(--hud-muted)]">
            Los challenges son obligatorios y sus rankings determinan quién
            obtiene un cupo. La postulación no reserva una plaza. Confirma
            únicamente si estas respuestas reflejan tu propio razonamiento sobre
            este código exacto.
          </p>
        </header>

        <dl className="grid gap-5 rounded-xl border border-white/15 bg-white/[0.03] p-6">
          <div>
            <dt className="font-mono text-xs uppercase tracking-wider text-[var(--hud-muted)]">
              Foco elegido
            </dt>
            <dd className="mt-1 text-[var(--hud-ink)]">
              {focusLabels[review.focus]}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-wider text-[var(--hud-muted)]">
              Traza de falla
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-[var(--hud-ink)]">
              {review.failureScenario}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-wider text-[var(--hud-muted)]">
              Evidencia revisada
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-[var(--hud-ink)]">
              {review.evidence}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-wider text-[var(--hud-muted)]">
              Decisión y confianza
            </dt>
            <dd className="mt-1 text-[var(--hud-ink)]">
              {review.decision.toUpperCase()} · {review.confidence}%
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-wider text-[var(--hud-muted)]">
              Riesgo restante
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-[var(--hud-ink)]">
              {review.remainingRisk}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-wider text-[var(--hud-muted)]">
              SHA-256 del source
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-[var(--hud-ink)]">
              {approval.sourceDigest}
            </dd>
          </div>
        </dl>

        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-[var(--hud-muted)]">
            No apruebes si el agente eligió el riesgo, inventó estas respuestas
            o tomó la decisión por ti. Vuelve al chat, pide una explicación y
            corrige el review primero.
          </p>
          {action}
        </div>
      </section>
    </ChallengesShell>
  );
}
