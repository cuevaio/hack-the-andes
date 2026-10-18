"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ProjectDetails } from "@/components/project-details";
import {
  type AdminBoard,
  type AdminCommand,
  weightedScore,
} from "@/lib/judging/contract";
import {
  adminKey,
  changeJudge,
  fetchAdminBoard,
  sendAdminCommand,
} from "@/lib/judging/queries";
import { JudgingRubric } from "./judging-rubric";
import { PresentationLinks } from "./presentation-links";
import { SessionClock, useFreshConnection } from "./session-clock";

const button =
  "whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40";
export function JudgingControl({
  initialData,
  adminId,
}: {
  initialData: AdminBoard;
  adminId: string;
}) {
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const query = useQuery({
    queryKey: adminKey(adminId),
    queryFn: ({ signal }) => fetchAdminBoard(signal),
    initialData,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    staleTime: 0,
  });
  async function refresh() {
    await client.cancelQueries({ queryKey: adminKey(adminId) });
    await client.invalidateQueries({ queryKey: adminKey(adminId) });
  }
  const action = useMutation({
    mutationFn: sendAdminCommand,
    retry: false,
    onSettled: refresh,
  });
  const judgeAction = useMutation({
    mutationFn: changeJudge,
    retry: false,
    onSuccess: () => setEmail(""),
    onSettled: refresh,
  });
  const fresh = useFreshConnection(query.dataUpdatedAt, query.isError);
  const connected = fresh && query.isFetchedAfterMount;
  const { session, presentations, evaluations, judges } = query.data;
  const busy = action.isPending || judgeAction.isPending || !connected;
  const current = presentations.find(
    (item) => item.id === session.currentPresentationId,
  );
  const queued = presentations.filter((item) => item.status === "queued");
  const next = queued[0];
  const previous = presentations.find((item) => item.status === "finished");
  const activeJudges = judges.filter((judge) => judge.active);
  const currentScores = evaluations.filter(
    (item) =>
      item.presentationId === current?.id &&
      item.submittedAt !== null &&
      activeJudges.some((judge) => judge.clerkUserId === item.judgeId),
  );
  const results = presentations
    .filter((item) => item.presentedAt !== null)
    .map((presentation) => {
      const scores = evaluations.filter(
        (item) =>
          item.presentationId === presentation.id &&
          item.submittedAt !== null &&
          activeJudges.some((judge) => judge.clerkUserId === item.judgeId),
      );
      let average: number | null = null;
      if (scores.length)
        average =
          scores.reduce((sum, score) => sum + (weightedScore(score) ?? 0), 0) /
          scores.length;
      let status = "Provisional";
      if (activeJudges.length > 0 && scores.length === activeJudges.length)
        status = "Completo";
      return { presentation, scores, average, status };
    })
    .sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
  function dispatch(command: AdminCommand) {
    action.mutate(command);
  }
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-10">
      <nav className="flex flex-wrap gap-5 text-sm">
        <Link className="underline" href="/admin/event">
          Control del evento
        </Link>
        <Link className="underline" href="/judging">
          Panel del jurado
        </Link>
      </nav>
      <header className="flex flex-wrap justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Hack the Andes · Organización
          </p>
          <h1 className="text-3xl font-semibold">Presentaciones y jurados</h1>
          <p className="text-muted-foreground">
            Tú decides cuándo pasa el siguiente equipo. Cada jurado conserva sus
            evaluaciones pendientes.
          </p>
        </div>
        <p role="status" className="text-sm">
          {connected ? "Sincronizado" : "Reconectando…"}
        </p>
      </header>
      <JudgingRubric />
      {!connected && (
        <p role="alert" className="rounded-xl border border-amber-500 p-4">
          No hay conexión actualizada. Los controles están desactivados hasta
          recuperar el estado del evento.
        </p>
      )}
      {action.isError && <p role="alert">{action.error.message}</p>}
      {!session.initializedAt && (
        <section className="space-y-4 rounded-2xl border p-6">
          <h2 className="text-xl font-semibold">Preparar la evaluación</h2>
          <p className="text-muted-foreground">
            Se congelarán los proyectos enviados, sus bitácoras y sus
            integrantes. Las ediciones posteriores no cambiarán lo que evalúen
            los jurados. Todos los jurados activos evaluarán a todos los
            equipos.
          </p>
          <button
            type="button"
            className={button}
            disabled={busy || activeJudges.length === 0}
            onClick={() =>
              dispatch({
                action: "initialize",
                expectedRevision: session.revision,
              })
            }
          >
            Congelar entregas y abrir evaluación
          </button>
          {activeJudges.length === 0 && (
            <p className="text-sm">Agrega al menos un jurado antes de abrir.</p>
          )}
        </section>
      )}
      {session.initializedAt && (
        <section className="space-y-5 rounded-2xl border p-6">
          <SessionClock session={session} />
          <div className="grid gap-4 md:grid-cols-2">
            {current && (
              <PresentationLinks presentation={current} label="Equipo actual" />
            )}
            {next && (
              <PresentationLinks presentation={next} label="Siguiente equipo" />
            )}
          </div>
          {current && (
            <>
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Presentación actual
                  </p>
                  <h2 className="text-2xl font-semibold">
                    {current.project.teamName}
                  </h2>
                </div>
                <p>
                  {currentScores.length} de {activeJudges.length} evaluaciones
                  recibidas
                </p>
              </div>
              <details>
                <summary className="cursor-pointer underline">
                  Proyecto del equipo actual
                </summary>
                <div className="mt-5">
                  <ProjectDetails project={current.project} />
                </div>
              </details>
            </>
          )}
          {current && currentScores.length < activeJudges.length && (
            <p className="text-sm text-amber-400">
              Faltan evaluaciones. Puedes avanzar; los jurados podrán
              terminarlas después.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {current && (
              <>
                <button
                  type="button"
                  className={button}
                  disabled={busy || session.remainingMs <= 0}
                  onClick={() =>
                    dispatch({
                      action: session.running ? "pause" : "resume",
                      expectedRevision: session.revision,
                    })
                  }
                >
                  {session.running ? "Pausar" : "Reanudar"}
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    dispatch({
                      action: "finish",
                      expectedRevision: session.revision,
                    })
                  }
                >
                  Finalizar presentación
                </button>
              </>
            )}
            {next && (
              <button
                type="button"
                className={`${button} bg-primary text-primary-foreground`}
                disabled={busy}
                onClick={() =>
                  dispatch({
                    action: "present",
                    presentationId: next.id,
                    expectedRevision: session.revision,
                  })
                }
              >
                {current ? "Siguiente equipo" : "Iniciar presentación"}
              </button>
            )}
          </div>
          {next && (
            <p className="text-sm text-muted-foreground">
              Siguiente: {next.project.teamName}
            </p>
          )}
        </section>
      )}
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Turnos de presentación</h2>
          <p className="text-sm text-muted-foreground">
            El orden se sorteó al abrir la evaluación y no se puede modificar.
            Solo se muestran el equipo anterior, el actual y el siguiente.
          </p>
          <p>Anterior: {previous?.project.teamName ?? "Ninguno"}</p>
          <p>Actual: {current?.project.teamName ?? "Ninguno"}</p>
          <p>
            Siguiente: {next?.project.teamName ?? "No hay equipos pendientes"}
          </p>
        </section>
        <section className="space-y-5 rounded-2xl border p-5">
          <h2 className="text-xl font-semibold">Jurados</h2>
          <p className="text-sm text-muted-foreground">
            Agrega su correo de Clerk. La persona debe haber iniciado sesión y
            verificado ese correo. Comparte el enlace /judging.
          </p>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              judgeAction.mutate({ email });
            }}
          >
            <label className="block space-y-2 text-sm">
              <span>Correo del jurado</span>
              <input
                type="email"
                required
                maxLength={320}
                className="w-full rounded-lg border bg-background p-3"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button type="submit" className={button} disabled={busy}>
              Agregar jurado
            </button>
          </form>
          {judgeAction.isError && (
            <p role="alert">{judgeAction.error.message}</p>
          )}
          {judges.map((judge) => (
            <div
              className="flex items-center justify-between gap-3 border-t pt-3"
              key={judge.clerkUserId}
            >
              <div>
                <p className="font-medium">{judge.name}</p>
                <p className="text-xs text-muted-foreground">
                  {judge.active ? "Activo" : "Inactivo"}
                </p>
              </div>
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() =>
                  judgeAction.mutate({
                    clerkUserId: judge.clerkUserId,
                    active: !judge.active,
                  })
                }
              >
                {judge.active ? "Desactivar" : "Activar"}
              </button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Desactivar bloquea el acceso y excluye sus puntajes del promedio.
            Los puntajes se conservan.
          </p>
        </section>
      </div>
      <section className="space-y-5">
        <h2 className="text-xl font-semibold">Resultados privados</h2>
        <p className="text-sm text-muted-foreground">
          Promedio de evaluaciones enviadas por jurados activos. Los borradores
          no cuentan. Un resultado es provisional hasta recibir todos los
          puntajes. Los empates comparten puntaje; la organización decide el
          desempate.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">Equipo</th>
                <th className="p-3">Puntaje / 100</th>
                <th className="p-3">Evaluaciones</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr className="border-b" key={result.presentation.id}>
                  <td className="p-3">
                    {result.presentation.project.teamName}
                  </td>
                  <td className="p-3 font-mono">
                    {result.average?.toFixed(1) ?? "—"}
                  </td>
                  <td className="p-3">
                    {result.scores.length} / {activeJudges.length}
                  </td>
                  <td className="p-3">{result.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {results.map((result) => (
          <details
            key={result.presentation.id}
            className="rounded-xl border p-5"
          >
            <summary className="cursor-pointer">
              {result.presentation.project.teamName} · Evaluaciones individuales
            </summary>
            <div className="mt-4 space-y-4">
              {evaluations
                .filter(
                  (evaluation) =>
                    evaluation.presentationId === result.presentation.id,
                )
                .map((evaluation) => (
                  <div
                    className="space-y-2 border-t pt-4"
                    key={evaluation.judgeId}
                  >
                    <p className="font-medium">
                      {judges.find(
                        (judge) => judge.clerkUserId === evaluation.judgeId,
                      )?.name ?? "Jurado"}{" "}
                      · {evaluation.submittedAt ? "Enviada" : "Borrador"}
                    </p>
                    <p>
                      Tracción: {evaluation.traction ?? "—"} · Técnica:{" "}
                      {evaluation.technical ?? "—"} · Pitch:{" "}
                      {evaluation.pitch ?? "—"}
                    </p>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {evaluation.notes}
                    </p>
                    {evaluation.submittedAt && (
                      <button
                        type="button"
                        className={button}
                        disabled={busy}
                        onClick={() =>
                          dispatch({
                            action: "reopen",
                            presentationId: result.presentation.id,
                            judgeId: evaluation.judgeId,
                            expectedRevision: session.revision,
                          })
                        }
                      >
                        Reabrir evaluación
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </details>
        ))}
      </section>
    </main>
  );
}
