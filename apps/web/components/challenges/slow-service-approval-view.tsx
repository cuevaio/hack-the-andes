import type { SlowServiceApprovalSnapshot } from "@chofex/challenges-contract";
import { EvaluationApprovalButton } from "./evaluation-approval-button";

const focusLabels = {
  atomic_corrections: "Correcciones atómicas",
  retroactive_solvency: "Solvencia retroactiva",
  historical_percentiles: "Percentiles históricos",
  history_capacity: "Capacidad del historial",
  cpu_growth: "Crecimiento de CPU",
};

export function SlowServiceApprovalView({
  id,
  snapshot,
  expiresAt,
  approvedAt,
  consumedAt,
  now = Date.now(),
}: {
  readonly id: string;
  readonly snapshot: SlowServiceApprovalSnapshot;
  readonly expiresAt: string;
  readonly approvedAt?: string;
  readonly consumedAt?: string;
  readonly now?: number;
}) {
  const review = snapshot.review;
  let action: React.ReactNode;
  if (consumedAt && approvedAt) {
    action = (
      <p>
        Esta aprobación ya fue usada. Cada evaluación requiere una aprobación
        nueva.
      </p>
    );
  } else if (consumedAt || Date.parse(expiresAt) <= now) {
    action = (
      <p>Esta aprobación venció. Repite el comando para generar una nueva.</p>
    );
  } else if (review.decision === "block") {
    action = (
      <p>
        La decisión block no autoriza una evaluación. Vuelve al agente para
        revisar el código y la evidencia.
      </p>
    );
  } else if (approvedAt) {
    action = (
      <p>Aprobación confirmada. Repite el mismo comando antes de que venza.</p>
    );
  } else {
    action = (
      <EvaluationApprovalButton
        approvalId={id}
        apiBasePath={`/api/v1/challenges/make-it-fast/approvals/${id}`}
      />
    );
  }
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-6 py-16">
      <header className="space-y-3">
        <p>The Slow Service · {snapshot.challengeVersion}</p>
        <h1 className="text-3xl font-semibold">
          Revisa y autoriza tu evaluación
        </h1>
        <p>
          Puedes usar AI para el código y esta revisión. Elige un caso concreto,
          revisa evidencia real y decide si autorizas el envío. Al aprobar,
          autorizas evaluar este código exacto y asumes responsabilidad por el
          envío. La revisión no demuestra comprensión ni autoría independiente.
        </p>
        <p>
          ship autoriza la evaluación, no un despliegue a producción. block
          detiene el envío. Cambiar el código o la revisión requiere una
          aprobación nueva.
        </p>
      </header>
      <dl className="grid gap-4 rounded-xl border border-white/15 p-6">
        <div>
          <dt>Foco</dt>
          <dd>{focusLabels[review.focus]}</dd>
        </div>
        <div>
          <dt>Caso de falla concreto</dt>
          <dd className="whitespace-pre-wrap">{review.failureScenario}</dd>
        </div>
        <div>
          <dt>Comando, inputs y resultados revisados</dt>
          <dd className="whitespace-pre-wrap">{review.evidence}</dd>
        </div>
        <div>
          <dt>Decisión y confianza</dt>
          <dd>
            {review.decision} · {review.confidence}%
          </dd>
        </div>
        <div>
          <dt>Riesgo restante</dt>
          <dd className="whitespace-pre-wrap">{review.remainingRisk}</dd>
        </div>
        <div>
          <dt>SHA-256 generado del código</dt>
          <dd className="break-all font-mono text-xs">{review.sourceDigest}</dd>
        </div>
        <div>
          <dt>Vence</dt>
          <dd>{expiresAt}</dd>
        </div>
      </dl>
      <details open>
        <summary>Código exacto que se evaluará</summary>
        <pre className="max-h-[32rem] overflow-auto rounded-xl border border-white/15 p-4 text-xs">
          <code>{snapshot.source}</code>
        </pre>
      </details>
      <p>
        El agente puede ayudarte a redactar, pero debe volver a ti para elegir
        la evidencia y confirmar el envío. No inventes resultados ni rellenes
        respuestas para alcanzar el mínimo de caracteres.
      </p>
      {action}
    </section>
  );
}
