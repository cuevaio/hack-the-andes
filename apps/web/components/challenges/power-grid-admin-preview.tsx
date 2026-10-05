"use client";

import {
  powerGridExample,
  powerGridStarterSource,
} from "@chofex/challenges-contract/power-grid";
import { BrandContainer } from "@chofex/ui/components/brand";
import { buttonVariants } from "@chofex/ui/components/button";
import { Schema } from "effect";
import Link from "next/link";
import { useState } from "react";
import {
  type AdminPreviewRequest,
  AdminPreviewRequestSchema,
  type AdminPreviewResult,
  AdminPreviewResultSchema,
  type PreviewObservation,
} from "@/lib/challenges/admin-preview-contract";

const control =
  "w-full rounded border border-border bg-background p-3 font-mono text-sm";
const download = (name: string, text: string) => {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};
const parseResult = (value: unknown): AdminPreviewResult => {
  if (typeof value !== "object" || value === null)
    throw new Error("El servidor no devolvió una respuesta válida.");
  if ("ok" in value && value.ok === false) {
    if (
      "error" in value &&
      typeof value.error === "object" &&
      value.error !== null &&
      "message" in value.error &&
      typeof value.error.message === "string"
    )
      throw new Error(value.error.message);
    throw new Error("No se pudo completar la prueba.");
  }
  if (!("data" in value))
    throw new Error("El servidor no devolvió un resultado.");
  return Schema.decodeUnknownSync(AdminPreviewResultSchema)(value.data);
};

export function PowerGridAdminPreview() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [input, setInput] = useState(JSON.stringify(powerGridExample, null, 2));
  const [source, setSource] = useState(powerGridStarterSource);
  const [observations, setObservations] = useState<PreviewObservation[]>([]);
  const [evaluations, setEvaluations] = useState(0);
  const [result, setResult] = useState<AdminPreviewResult | null>(null);
  const execute = async (request: AdminPreviewRequest) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/v1/admin/challenges/power-grid/preview",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-challenge-preview-secret": secret,
          },
          body: JSON.stringify(request),
          credentials: "same-origin",
        },
      );
      const data = parseResult(await response.json());
      setResult(data);
      if (data.action === "unlock") setUnlocked(true);
      if (data.action === "query")
        setObservations((items) => [...items, data.observation]);
      if (data.action === "evaluate") setEvaluations((count) => count + 1);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo completar la prueba.",
      );
    } finally {
      setBusy(false);
    }
  };
  const query = async () => {
    try {
      const value: unknown = JSON.parse(input);
      const request = Schema.decodeUnknownSync(AdminPreviewRequestSchema)({
        action: "query",
        input: value,
      });
      if (request.action !== "query") throw new Error("Invalid query");
      const encoded = JSON.stringify(request.input);
      if (observations.some((item) => JSON.stringify(item.input) === encoded)) {
        setError("Esa lectura ya está en tu cuaderno.");
        return;
      }
      await execute(request);
    } catch {
      setError(
        "Introduce una lectura JSON válida con los cinco campos y valores dentro del contrato.",
      );
    }
  };
  return (
    <BrandContainer className="space-y-8 py-10">
      <Link href="/admin/participants" className="text-sm underline">
        Volver a participantes
      </Link>
      <div>
        <p className="font-mono text-sm">Prueba privada / Challenge 04</p>
        <h1 className="mt-3 font-display text-4xl uppercase">
          La máquina de facturación eléctrica
        </h1>
        <p className="mt-4 max-w-3xl">
          Descubre las reglas de un servicio sin documentación. Recibe cinco
          campos y devuelve el importe en céntimos enteros. Las tarifas son
          ficticias; cada lectura es independiente.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Solo para cuentas con acceso al panel de administración y la clave
          compartida. Cada admin tiene sus propias reglas. Estas pruebas no
          crean intentos de participante ni cambian rankings o postulaciones. La
          clave y el cuaderno permanecen en esta pestaña hasta que la cierres o
          recargues.
        </p>
      </div>
      {!unlocked ? (
        <form
          className="max-w-lg space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void execute({ action: "unlock" });
          }}
        >
          <label className="block" htmlFor="preview-secret">
            Clave de prueba
          </label>
          <input
            id="preview-secret"
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            className={control}
            required
          />
          <button type="submit" disabled={busy} className={buttonVariants()}>
            Abrir prueba
          </button>
        </form>
      ) : (
        <>
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Consulta la máquina</h2>
              <p className="text-sm">
                Consumo importado <code>consumptionKwh</code>: entero de 0 a
                2,000. Demanda máxima <code>demandKw</code>: entero de 0 a 100.
                Hora de cierre <code>hour</code>: entero de 0 a 23.{" "}
                <code>solar</code> y <code>business</code>: booleanos para
                generación solar y contrato comercial.
              </p>
              <label htmlFor="preview-input" className="block">
                Lectura JSON
              </label>
              <textarea
                id="preview-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={9}
                className={control}
              />
              <button
                type="button"
                disabled={busy || observations.length >= 25}
                onClick={() => void query()}
                className={buttonVariants()}
              >
                Consultar
              </button>
              <p className="text-sm">
                {observations.length} / 25 consultas en esta pestaña. Cambia una
                variable a la vez.
              </p>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Prueba tu solución</h2>
              <p className="text-sm">
                Define <code>calculateBill(input)</code>. Devuelve un número
                finito en céntimos enteros. Usa una función global o{" "}
                <code>module.exports</code>, sin imports, archivos ni red. El
                límite es de 32,768 caracteres.
              </p>
              <label htmlFor="preview-source" className="block">
                Código JavaScript
              </label>
              <textarea
                id="preview-source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                rows={9}
                className={control}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy || !observations.length}
                  onClick={() =>
                    void execute({ action: "test", source, observations })
                  }
                  className={buttonVariants({ variant: "outline" })}
                >
                  Probar cuaderno
                </button>
                <button
                  type="button"
                  disabled={busy || evaluations >= 3}
                  onClick={() => void execute({ action: "evaluate", source })}
                  className={buttonVariants()}
                >
                  Evaluar solución
                </button>
                <button
                  type="button"
                  onClick={() => download("bill.js", source)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Descargar código
                </button>
              </div>
              <p className="text-sm">
                {evaluations} / 3 evaluaciones en esta pestaña. Cada evaluación
                usa 1,000 lecturas ocultas. Probar el cuaderno es gratis y no
                certifica el puntaje oculto. Los límites son una simulación
                local para admins; recargar permite repetir la prueba con las
                mismas reglas.
              </p>
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Cuaderno de observaciones</h2>
            <button
              type="button"
              disabled={!observations.length}
              onClick={() =>
                download(
                  "observations.json",
                  JSON.stringify(observations, null, 2),
                )
              }
              className={buttonVariants({ variant: "outline" })}
            >
              Descargar cuaderno
            </button>
            <pre className="overflow-x-auto rounded border p-4 text-sm">
              {JSON.stringify(observations, null, 2)}
            </pre>
          </section>
          {result?.action === "query" && (
            <p role="status">Importe: {result.observation.output} céntimos</p>
          )}
          {result?.action === "test" && (
            <div role="status">
              <p>
                Cuaderno: {result.result.matchedObservations} /{" "}
                {result.result.observationCount} coincidencias exactas.
              </p>
              <pre className="mt-3 overflow-auto text-sm">
                {JSON.stringify(result.result.mismatches, null, 2)}
              </pre>
            </div>
          )}
          {result?.action === "evaluate" && (
            <p role="status">
              Puntaje: {(result.score.accuracy * 100).toFixed(2)}%.{" "}
              {result.score.exactCount} / {result.score.sampleSize} lecturas
              exactas. Error medio: {result.score.meanError.toFixed(2)}{" "}
              céntimos.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {busy && <p role="status">Procesando la prueba…</p>}
    </BrandContainer>
  );
}
