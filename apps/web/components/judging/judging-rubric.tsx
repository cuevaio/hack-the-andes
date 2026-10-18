import { rubric } from "@/lib/judging/contract";

export function JudgingRubric() {
  return (
    <section
      aria-labelledby="judging-rubric-title"
      className="space-y-5 rounded-2xl border p-6"
    >
      <div className="space-y-2">
        <h2 id="judging-rubric-title" className="text-xl font-semibold">
          Rúbrica de evaluación
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Lee los criterios antes de evaluar al primer equipo. Califica cada
          criterio del 1 al 5 según la evidencia presentada. El puntaje final
          combina los tres criterios según su peso, hasta un máximo de 100
          puntos.
        </p>
      </div>
      <dl className="grid gap-5 md:grid-cols-3">
        {rubric.map((item) => (
          <div key={item.key} className="space-y-2">
            <dt className="flex items-baseline justify-between gap-3 font-medium">
              <span>{item.label}</span>
              <span className="text-muted-foreground">{item.weight}</span>
            </dt>
            <dd className="text-sm leading-relaxed text-muted-foreground">
              {item.anchors}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
