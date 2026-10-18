import type { Presentation } from "@/lib/judging/contract";

function AnalysisList({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h4 className="font-medium">{title}</h4>
      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function RepositoryAnalysis({
  analysis,
}: {
  analysis: Presentation["repositoryAnalysis"];
}) {
  if (!analysis) {
    return (
      <p className="text-sm text-muted-foreground">
        El análisis del repositorio todavía no está disponible.
      </p>
    );
  }
  return (
    <details className="space-y-4 rounded-xl border p-5">
      <summary className="cursor-pointer font-medium">
        Análisis del repositorio con Claude Code
      </summary>
      <div className="space-y-5 pt-2">
        <p className="text-sm text-muted-foreground">
          Revisión automática de apoyo. El jurado decide el puntaje y debe
          contrastar los hallazgos con la demostración.
        </p>
        {analysis.status === "unavailable" && (
          <p role="status" className="text-sm">
            No se pudo completar la revisión del código.
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {analysis.summary}
        </p>
        {analysis.architecture && (
          <section className="space-y-2">
            <h4 className="font-medium">Arquitectura</h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {analysis.architecture}
            </p>
          </section>
        )}
        <AnalysisList
          title="Funciones implementadas"
          items={analysis.implementedFeatures}
        />
        <AnalysisList title="Fortalezas" items={analysis.strengths} />
        <AnalysisList title="Riesgos y pendientes" items={analysis.risks} />
        <AnalysisList
          title="Preguntas para el equipo"
          items={analysis.questions}
        />
        <AnalysisList
          title="Alcance y limitaciones"
          items={analysis.limitations}
        />
        <dl className="space-y-2 border-t pt-4 text-xs text-muted-foreground">
          <div>
            <dt className="font-medium">Repositorio revisado</dt>
            <dd className="break-all">{analysis.repositoryUrl}</dd>
          </div>
          {analysis.commitSha && (
            <div>
              <dt className="font-medium">Commit revisado</dt>
              <dd className="break-all font-mono">{analysis.commitSha}</dd>
            </div>
          )}
          <div>
            <dt className="font-medium">Fecha del análisis</dt>
            <dd>
              <time dateTime={analysis.analyzedAt}>
                {new Date(analysis.analyzedAt).toLocaleString("es-PE", {
                  timeZone: "America/Lima",
                })}{" "}
                (Lima)
              </time>
            </dd>
          </div>
          <div>
            <dt className="font-medium">Modelo</dt>
            <dd>{analysis.model}</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}
