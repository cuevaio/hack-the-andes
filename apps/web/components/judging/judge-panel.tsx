"use client";

import { useQuery } from "@tanstack/react-query";
import { type JudgeBoard, weightedScore } from "@/lib/judging/contract";
import { fetchJudgeBoard, judgeKey } from "@/lib/judging/queries";
import { EvaluationForm } from "./evaluation-form";
import { JudgingRubric } from "./judging-rubric";
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
  const submittedIds = new Set(
    evaluations
      .filter((item) => item.submittedAt !== null)
      .map((item) => item.presentationId),
  );
  const history = presentations.filter((item) => submittedIds.has(item.id));
  const pending = presentations
    .filter((item) => item.presentedAt !== null && !submittedIds.has(item.id))
    .sort(
      (a, b) =>
        Number(b.id === session.currentPresentationId) -
        Number(a.id === session.currentPresentationId),
    );
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-5 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Hack the Andes
          </p>
          <h1 className="text-3xl font-semibold">Panel del jurado</h1>
          <p className="text-sm text-muted-foreground">
            Tus puntajes son privados. Puedes revisar y editar tus evaluaciones
            en cualquier momento.
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
              <p role="status">La presentación actual se está sincronizando.</p>
            )}
            {!session.initializedAt && (
              <p>La organización todavía no ha abierto la evaluación.</p>
            )}
          </>
        )}
      </section>
      <JudgingRubric />
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
      <section className="space-y-4" aria-label="Mis evaluaciones">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">
            Mis evaluaciones · {history.length}
          </h2>
          <p className="text-sm text-muted-foreground">
            Abre un equipo para ver tus puntajes, notas y proyecto, o guardar
            cambios.
          </p>
        </div>
        {history.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todavía no has enviado evaluaciones.
          </p>
        )}
        {history.map((presentation) => {
          const evaluation = evaluations.find(
            (item) => item.presentationId === presentation.id,
          );
          if (!evaluation) return null;
          return (
            <details key={presentation.id} className="rounded-2xl border">
              <summary className="cursor-pointer p-5">
                <span className="font-semibold">
                  {presentation.project.teamName}
                </span>
                <span className="ml-3 text-sm">
                  {weightedScore(evaluation)} / 100
                </span>
                <span className="mt-2 block text-sm text-muted-foreground">
                  Tracción: {evaluation.traction} / 5 · Técnica:{" "}
                  {evaluation.technical} / 5 · Pitch: {evaluation.pitch} / 5
                </span>
              </summary>
              <EvaluationForm
                presentation={presentation}
                evaluation={evaluation}
                judgeId={judgeId}
                current={
                  connected && presentation.id === session.currentPresentationId
                }
                connected={connected}
              />
            </details>
          );
        })}
      </section>
      <section className="space-y-2 rounded-xl border p-5" aria-live="polite">
        <h2 className="font-semibold">
          Equipos pendientes · {query.data.remainingTeams}
        </h2>
        <p className="text-sm text-muted-foreground">
          Por presentar. El orden de los equipos se mantiene oculto.
        </p>
      </section>
    </main>
  );
}
