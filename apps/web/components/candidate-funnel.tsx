import type { CandidatePage } from "@/lib/admin/types";

export function CandidateFunnel({
  data,
  unavailable,
}: {
  readonly data: CandidatePage;
  readonly unavailable: boolean;
}) {
  const stages = [
    { label: "Postulaciones", value: data.counts.all },
    { label: "Registro completo", value: data.funnel.submitted },
    { label: "Reto iniciado", value: data.funnel.challengeStarted },
    { label: "Reto evaluado", value: data.funnel.challengeCompleted },
  ];
  return (
    <section
      className="mt-8"
      aria-labelledby="candidate-funnel-title"
      aria-busy={unavailable}
    >
      <div className="mb-3">
        <h2 id="candidate-funnel-title" className="text-base font-semibold">
          Embudo de participantes
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Según búsqueda, residencia y reto. Incluye todos los estados, antes de
          paginar.
        </p>
      </div>
      <ol className="grid grid-cols-2 gap-px border bg-border lg:grid-cols-5">
        {stages.map((stage) => {
          let width = 0;
          if (!unavailable && data.counts.all > 0)
            width = (stage.value / data.counts.all) * 100;
          return (
            <li key={stage.label} className="bg-card p-4">
              <p className="text-xs text-muted-foreground">{stage.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {unavailable ? "—" : stage.value}
              </p>
              <div aria-hidden="true" className="mt-3 h-1 bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
        <li className="col-span-2 bg-card p-4 lg:col-span-1">
          <p className="text-xs text-muted-foreground">Decisiones</p>
          <div className="mt-2 flex gap-5">
            <div>
              <p className="text-3xl font-semibold tabular-nums">
                {unavailable ? "—" : data.counts.approved}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Aprobados</p>
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums">
                {unavailable ? "—" : data.counts.declined}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Rechazados</p>
            </div>
          </div>
        </li>
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        Hitos registrados, no conversiones entre etapas. El progreso en retos
        puede venir de una postulación anterior.
      </p>
    </section>
  );
}
