"use client";

import { useQuery } from "@tanstack/react-query";
import { ProjectDetails } from "@/components/project-details";
import type { JudgeBoard } from "@/lib/judging/contract";
import { fetchJudgeBoard, judgeKey } from "@/lib/judging/queries";
import { EvaluationForm } from "./evaluation-form";
import { SessionClock, useFreshConnection } from "./session-clock";

export function JudgePanel({
  initialData,
  judgeId,
}: {
  initialData: JudgeBoard;
  judgeId: string;
}) {
  const query = useQuery({
    queryKey: judgeKey(judgeId),
    queryFn: ({ signal }) => fetchJudgeBoard(signal),
    initialData,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    staleTime: 0,
  });
  const fresh = useFreshConnection(query.dataUpdatedAt, query.isError);
  const connected = fresh && query.isFetchedAfterMount;
  const { session, presentations, evaluations } = query.data;
  const current = presentations.find(
    (item) => item.id === session.currentPresentationId,
  );
  const pending = presentations
    .filter((item) => item.presentedAt !== null)
    .sort(
      (a, b) =>
        Number(b.id === session.currentPresentationId) -
        Number(a.id === session.currentPresentationId),
    );
  const queued = presentations.filter((item) => item.status === "queued");
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-5 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Hack the Andes
          </p>
          <h1 className="text-3xl font-semibold">Panel del jurado</h1>
          <p className="text-sm text-muted-foreground">
            Tus puntajes son privados. Evalúa a cada equipo una sola vez.
          </p>
        </div>
        <span role="status" className="rounded-full border px-3 py-1 text-sm">
          {connected ? "Sincronizado" : "Reconectando…"}
        </span>
      </header>
      <section
        aria-label="Estado de la presentación"
        className="sticky top-0 z-20 space-y-3 border-b bg-background py-3"
      >
        {!connected && (
          <p role="alert" className="rounded-xl border border-amber-500 p-4">
            No podemos confirmar quién presenta ahora. Espera la reconexión para
            evaluar; tus cambios pendientes se conservan en esta página.
          </p>
        )}
        {connected && (
          <>
            <SessionClock session={session} />
            {current && (
              <p className="text-lg" aria-live="polite" aria-atomic="true">
                Ahora presenta: <strong>{current.project.teamName}</strong>
              </p>
            )}
            {!current && session.currentPresentationId && (
              <p role="status">
                Ya evaluaste al equipo que está presentando. Esperando al
                siguiente equipo.
              </p>
            )}
            {!session.initializedAt && (
              <p>La organización todavía no ha abierto la evaluación.</p>
            )}
          </>
        )}
      </section>
      <div className="space-y-6">
        {pending.map((presentation) => (
          <EvaluationForm
            key={presentation.id}
            presentation={presentation}
            evaluation={evaluations.find(
              (item) => item.presentationId === presentation.id,
            )}
            judgeId={judgeId}
            current={
              connected && presentation.id === session.currentPresentationId
            }
            connected={connected}
          />
        ))}
      </div>
      <details className="rounded-xl border p-5">
        <summary className="cursor-pointer font-semibold">
          Equipos pendientes · {queued.length}
        </summary>
        <div className="mt-5 space-y-4">
          {queued.length === 0 && (
            <p className="text-muted-foreground">
              No hay equipos pendientes de presentar.
            </p>
          )}
          {queued.map((presentation) => (
            <details className="rounded-lg border p-4" key={presentation.id}>
              <summary className="cursor-pointer">
                {presentation.project.teamName}
              </summary>
              <div className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  {presentation.members.join(" · ")}
                </p>
                <ProjectDetails project={presentation.project} />
              </div>
            </details>
          ))}
        </div>
      </details>
    </main>
  );
}
