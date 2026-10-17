"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import { useEffect, useState } from "react";
import { ProjectDetails } from "@/components/project-details";
import {
  type Evaluation,
  type EvaluationFields,
  type Presentation,
  rubric,
  weightedScore,
} from "@/lib/judging/contract";
import { judgeKey, sendEvaluation } from "@/lib/judging/queries";

const empty: EvaluationFields = {
  traction: null,
  technical: null,
  pitch: null,
  notes: "",
};
const scoreSchema = Schema.NullOr(Schema.Literals([1, 2, 3, 4, 5]));
function fieldsOf(evaluation?: Evaluation): EvaluationFields {
  if (!evaluation) return empty;
  return {
    traction: evaluation.traction,
    technical: evaluation.technical,
    pitch: evaluation.pitch,
    notes: evaluation.notes,
  };
}
export function EvaluationForm({
  presentation,
  evaluation,
  judgeId,
  current,
  connected,
}: {
  presentation: Presentation;
  evaluation: Evaluation | undefined;
  judgeId: string;
  current: boolean;
  connected: boolean;
}) {
  const client = useQueryClient();
  const [fields, setFields] = useState(() => fieldsOf(evaluation));
  const [saved, setSaved] = useState(() => ({
    fields: fieldsOf(evaluation),
    revision: evaluation?.revision ?? 0,
  }));
  const [submitted, setSubmitted] = useState(false);
  const [conflict, setConflict] = useState(false);
  const mutation = useMutation({
    mutationFn: ({
      submit,
      snapshot,
    }: {
      submit: boolean;
      snapshot: EvaluationFields;
    }) =>
      sendEvaluation({
        ...snapshot,
        presentationId: presentation.id,
        expectedRevision: saved.revision,
        submit,
      }),
    retry: false,
    onSuccess: async (board, variables) => {
      const updated = board.evaluations.find(
        (item) => item.presentationId === presentation.id,
      );
      if (variables.submit) setSubmitted(true);
      else if (updated)
        setSaved({ fields: variables.snapshot, revision: updated.revision });
      await client.cancelQueries({ queryKey: judgeKey(judgeId) });
      await client.invalidateQueries({ queryKey: judgeKey(judgeId) });
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: judgeKey(judgeId) });
    },
  });
  const dirty = JSON.stringify(fields) !== JSON.stringify(saved.fields);
  const serverRevision = evaluation?.revision ?? 0;
  useEffect(() => {
    if (mutation.isPending || serverRevision <= saved.revision) return;
    if (dirty) {
      setConflict(true);
      return;
    }
    const latest = fieldsOf(evaluation);
    setFields(latest);
    setSaved({ fields: latest, revision: serverRevision });
  }, [serverRevision, saved.revision, dirty, evaluation, mutation.isPending]);
  const { mutate } = mutation;
  useEffect(() => {
    if (
      !dirty ||
      !connected ||
      conflict ||
      mutation.isPending ||
      mutation.isError ||
      submitted
    )
      return;
    const timeout = setTimeout(
      () => mutate({ submit: false, snapshot: fields }),
      800,
    );
    return () => clearTimeout(timeout);
  }, [
    dirty,
    connected,
    conflict,
    mutation.isPending,
    mutation.isError,
    submitted,
    fields,
    mutate,
  ]);
  const total = weightedScore(fields);
  let presentationLabel = "Evaluación pendiente · presentación anterior";
  if (current) presentationLabel = "Presentación actual";
  if (!connected) presentationLabel = "Esperando sincronización";
  let saveLabel = "Borrador guardado";
  if (dirty) saveLabel = "Cambios pendientes de guardar";
  if (mutation.isPending) saveLabel = "Guardando…";
  if (submitted)
    return (
      <p role="status" className="rounded-xl border p-6">
        Evaluación enviada. Esperando al siguiente equipo.
      </p>
    );
  return (
    <article className="space-y-6 rounded-2xl border p-5 md:p-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {presentationLabel}
        </p>
        <h2 className="text-2xl font-semibold">
          {presentation.project.teamName}
        </h2>
        <p className="text-sm text-muted-foreground">
          {presentation.members.join(" · ")}
        </p>
      </header>
      <details open={current}>
        <summary className="cursor-pointer text-sm underline">
          Ver proyecto y evidencia
        </summary>
        <div className="mt-5">
          <ProjectDetails project={presentation.project} />
        </div>
      </details>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (connected && !conflict && !mutation.isPending)
            mutation.mutate({ submit: true, snapshot: fields });
        }}
      >
        <fieldset
          disabled={!connected || mutation.isPending || conflict}
          className="space-y-5 disabled:opacity-60"
        >
          <legend className="mb-4 text-lg font-semibold">Tu evaluación</legend>
          {rubric.map((item) => (
            <label key={item.key} className="block space-y-2">
              <span className="flex justify-between font-medium">
                <span>{item.label}</span>
                <span className="text-muted-foreground">{item.weight}</span>
              </span>
              <span className="block text-sm leading-relaxed text-muted-foreground">
                {item.anchors}
              </span>
              <select
                aria-label={item.label}
                className="w-full rounded-lg border bg-background px-3 py-3"
                value={fields[item.key] ?? ""}
                onChange={(event) => {
                  let value: number | null = null;
                  if (event.target.value) value = Number(event.target.value);
                  const parsed = Schema.decodeUnknownSync(scoreSchema)(value);
                  setFields((previous) => ({
                    ...previous,
                    [item.key]: parsed,
                  }));
                }}
              >
                <option value="">Elige un puntaje</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value} / 5
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="block space-y-2">
            <span>Notas privadas para la organización</span>
            <textarea
              className="min-h-24 w-full rounded-lg border bg-background p-3"
              maxLength={4000}
              value={fields.notes}
              onChange={(event) =>
                setFields((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
            />
          </label>
        </fieldset>
        <p className="text-sm">
          Esta evaluación corresponde a{" "}
          <strong>{presentation.project.teamName}</strong>.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xl font-semibold">
            Total: {total ?? "—"}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / 100
            </span>
          </p>
          <button
            type="submit"
            disabled={
              !connected || conflict || mutation.isPending || total === null
            }
            className="whitespace-nowrap rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground disabled:opacity-50"
          >
            Enviar evaluación
          </button>
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          {saveLabel}. Al enviar, el equipo desaparecerá de tu vista.
        </p>
        {mutation.isError && (
          <div role="alert" className="space-y-2">
            <p>{mutation.error.message}</p>
            <button
              className="underline"
              type="button"
              disabled={!connected || mutation.isPending || conflict}
              onClick={() =>
                mutation.mutate({ submit: false, snapshot: fields })
              }
            >
              Reintentar guardado
            </button>
          </div>
        )}
        {conflict && (
          <div role="alert" className="space-y-2">
            <p>
              Esta evaluación cambió en otra pestaña. Tus cambios locales siguen
              aquí. Revisa los puntajes antes de reemplazarlos.
            </p>
            <button
              type="button"
              className="underline"
              onClick={() => {
                const latest = fieldsOf(evaluation);
                setFields(latest);
                setSaved({ fields: latest, revision: serverRevision });
                setConflict(false);
                mutation.reset();
              }}
            >
              Cargar versión guardada
            </button>
          </div>
        )}
      </form>
    </article>
  );
}
