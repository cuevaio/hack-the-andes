"use client";

import { Badge } from "@chofex/ui/components/badge";
import { Button } from "@chofex/ui/components/button";
import { CheckIcon, XIcon } from "lucide-react";

import type { Candidate, CandidateStatus } from "@/lib/admin/types";
import { reviewableCandidateStatuses } from "@/lib/admin/types";
import { formatChallengeScore } from "@/lib/challenges/score";

const statusLabels: Record<CandidateStatus, string> = {
  draft: "Borrador",
  submitted: "Pendiente de decisión",
  under_review: "En revisión",
  waitlisted: "En espera",
  accepted: "Aprobado",
  rejected: "Rechazado",
  withdrawn: "Retirado",
};

export function CandidateRankingRows({
  candidates,
  onReview,
}: {
  readonly candidates: ReadonlyArray<Candidate>;
  readonly onReview: (
    candidateId: string,
    decision?: "accepted" | "rejected",
  ) => void;
}) {
  return (
    <div>
      <div className="hidden gap-4 border-b bg-muted/35 px-5 py-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase lg:grid lg:grid-cols-[4rem_minmax(0,1.2fr)_minmax(0,1fr)_10rem_15rem]">
        <span>Posición global</span>
        <span>Participante</span>
        <span>Resultado</span>
        <span>Postulación</span>
        <span className="text-right">Revisión</span>
      </div>
      <div className="divide-y">
        {candidates.map((candidate) => {
          const result = candidate.rankingResult;
          const reviewable = reviewableCandidateStatuses.includes(
            candidate.status,
          );
          let variant: "statusSubmitted" | "statusAccepted" | "statusRejected" =
            "statusSubmitted";
          if (candidate.status === "accepted") variant = "statusAccepted";
          if (candidate.status === "rejected") variant = "statusRejected";
          return (
            <div
              key={candidate.id}
              className="grid gap-3 px-4 py-4 lg:grid-cols-[4rem_minmax(0,1.2fr)_minmax(0,1fr)_10rem_15rem] lg:items-center lg:gap-4 lg:px-5"
            >
              <span className="text-lg font-semibold text-primary tabular-nums">
                #{result?.rank}
              </span>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onReview(candidate.id)}
                  className="max-w-full truncate text-left text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={`Ver detalles de ${candidate.name}`}
                >
                  {candidate.name}
                </button>
                <p className="truncate text-xs text-muted-foreground">
                  {candidate.email}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {[candidate.city, candidate.countryCode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              {result && (
                <div className="text-xs tabular-nums">
                  <p className="text-sm font-semibold">
                    Puntaje {formatChallengeScore(result.score.accuracy)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Aciertos {result.score.exactCount}/{result.score.sampleSize}
                  </p>
                  <p className="text-muted-foreground">
                    Consultas {result.score.queriesUsed}
                    {result.score.evaluationsUsed !== undefined &&
                      ` · Evaluaciones ${result.score.evaluationsUsed}`}
                  </p>
                  {result.score.executionCost !== undefined && (
                    <p className="text-muted-foreground">
                      Costo {result.score.executionCost}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Error medio {result.score.meanError}
                  </p>
                  <p className="text-muted-foreground">
                    Ejecución {result.score.runtimeMs} ms
                  </p>
                </div>
              )}
              <div>
                <Badge variant={variant}>
                  {statusLabels[candidate.status]}
                </Badge>
                {candidate.status === "draft" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Debe enviar su postulación para recibir una decisión.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReview(candidate.id)}
                >
                  Ver detalles
                </Button>
                {reviewable && (
                  <>
                    <Button
                      size="sm"
                      aria-label={`Aprobar a ${candidate.name}`}
                      onClick={() => onReview(candidate.id, "accepted")}
                    >
                      <CheckIcon />
                      Aprobar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label={`Rechazar a ${candidate.name}`}
                      onClick={() => onReview(candidate.id, "rejected")}
                    >
                      <XIcon />
                      Rechazar
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
