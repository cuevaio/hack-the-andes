import { playableChallenges } from "@chofex/challenges-contract";
import {
  BrandContainer,
  BrandHeader,
  BrandKicker,
  BrandPage,
} from "@chofex/ui/components/brand";

import { planAttendance } from "@/lib/admin/attendance-plan";
import {
  candidateFilterQuery,
  countryFilterLabel,
  countryFilterOptions,
  countryFilterValue,
} from "@/lib/admin/candidate-filters";
import { type HistoryQuery, limaDay } from "@/lib/admin/history-query";
import {
  type ParticipantHistory as HistoryReport,
  type HistoryStage,
  historyStages,
} from "@/lib/admin/participant-history";

const stages: Record<HistoryStage, { label: string; color: string }> = {
  registered: { label: "Sin postulación", color: "#8b9a9d" },
  draft: { label: "Registro iniciado", color: "#786455" },
  submitted: { label: "Postulación enviada", color: "#ae7139" },
  challenge_started: { label: "Reto iniciado", color: "#6d78a0" },
  challenge_completed: { label: "Reto evaluado", color: "#435780" },
  accepted: { label: "Aceptado sin confirmación registrada", color: "#467979" },
  confirmed: { label: "Confirmación registrada", color: "#20574a" },
  rejected: { label: "Rechazado", color: "#9d4439" },
  withdrawn: { label: "Retirado", color: "#514f4c" },
  unknown: { label: "Historial insuficiente", color: "#b8b5af" },
};
const number = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 0,
});
const field =
  "h-11 w-full min-w-0 border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-primary";
const link =
  "inline-flex min-h-11 items-center justify-center border px-4 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary whitespace-nowrap";
const dateLabel = (day: string) =>
  new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  }).format(new Date(`${day}T12:00:00-05:00`));

function HistoryHiddenFields({ query }: { readonly query: HistoryQuery }) {
  return (
    <>
      <input type="hidden" name="end" value={query.end} />
      <input type="hidden" name="days" value={query.days} />
      <input
        type="hidden"
        name="country"
        value={countryFilterValue(query.country)}
      />
      <input type="hidden" name="challenge" value={query.challenge ?? ""} />
    </>
  );
}

export function ParticipantHistory({
  data,
  query,
}: {
  readonly data: HistoryReport;
  readonly query: HistoryQuery;
}) {
  const plan = planAttendance(data.current, query);
  const current = data.current;
  const selected = data.days.at(-1);
  const previous = data.days.at(-2);
  const highest = Math.max(1, ...data.days.map((day) => day.people));
  const scopeQuery = candidateFilterQuery({
    page: 1,
    query: "",
    country: query.country,
    challenge: query.challenge,
  });
  const countryScope = countryFilterLabel(query.country);
  let challengeScope = "Todas las personas";
  if (query.challenge)
    challengeScope = `Personas que iniciaron ${playableChallenges.find((challenge) => challenge.slug === query.challenge)?.theme} hasta hoy`;
  let pace = "La fecha del evento ya llegó";
  if (plan.requiredDaily !== null)
    pace = `${number.format(plan.requiredDaily)} confirmaciones por día`;
  const dayHref = (end: string) => {
    const params = new URLSearchParams(scopeQuery);
    params.set("end", end);
    params.set("days", String(query.days));
    params.set("showUp", String(query.showUpPercent));
    if (query.costPerConfirmation !== undefined)
      params.set("cost", String(query.costPerConfirmation));
    return `/admin/insights/history?${params}#history-title`;
  };

  return (
    <BrandPage>
      <BrandHeader>
        <span className="font-semibold">Administración</span>
        <a className={link} href={`/admin/insights?${scopeQuery}`}>
          Ver distribución actual
        </a>
      </BrandHeader>
      <BrandContainer>
        <main className="space-y-10 py-8 sm:py-12">
          <header className="space-y-3">
            <BrandKicker>Estadísticas / evolución</BrandKicker>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Camino a {plan.target} personas en Lima
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              ¿Cuánto avanzamos, dónde se detienen las personas y qué falta para
              el {dateLabel(plan.eventDate)}?
            </p>
            <a className={link} href="#history-title">
              Ir a la evolución diaria
            </a>
          </header>

          <section
            aria-labelledby="attendance-goal"
            className="space-y-5 border bg-card p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="attendance-goal" className="text-xl font-semibold">
                  Meta presencial · {dateLabel(plan.eventDate)}{" "}
                  {plan.eventDate.slice(0, 4)}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Situación global actual. Los filtros históricos no cambian
                  esta meta.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Actualizado{" "}
                {new Intl.DateTimeFormat("es-PE", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Lima",
                }).format(new Date(data.generatedAt))}{" "}
                · Lima
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Metric
                label="Confirmados presenciales"
                value={current.onSiteConfirmed}
                note="Aceptados con todos los datos requeridos."
              />
              <Metric
                label="Por confirmar"
                value={current.onSiteAwaitingConfirmation}
                note="Ya aceptados para asistir en persona."
              />
              <Metric
                label="Asistencia en el escenario"
                value={number.format(plan.expectedAttendance)}
                note={`Con ${query.showUpPercent}% de asistencia supuesta.`}
              />
              <Metric
                label="Confirmaciones adicionales"
                value={plan.additionalConfirmations}
                note={pace}
              />
            </div>
            <label className="block text-sm" htmlFor="goal-progress">
              {number.format(plan.expectedAttendance)} / {plan.target}{" "}
              asistentes en el escenario
            </label>
            <progress
              id="goal-progress"
              className="h-3 w-full accent-primary"
              value={Math.min(plan.target, plan.expectedAttendance)}
              max={plan.target}
            />

            <form
              action="/admin/insights/history"
              method="get"
              className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <HistoryHiddenFields query={query} />
              <label className="grid gap-1.5 text-sm">
                Asistencia supuesta de confirmados (%)
                <input
                  className={field}
                  name="showUp"
                  type="number"
                  min="1"
                  max="100"
                  step="0.1"
                  required
                  defaultValue={query.showUpPercent}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                Costo supuesto por nueva confirmación (S/)
                <input
                  className={field}
                  name="cost"
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  placeholder="Opcional"
                  defaultValue={query.costPerConfirmation}
                />
              </label>
              <button
                type="submit"
                className={`${link} bg-primary text-primary-foreground`}
              >
                Calcular escenario
              </button>
            </form>
            <div
              className="space-y-2 text-sm text-muted-foreground"
              role="status"
            >
              <p>
                Este escenario necesita {plan.requiredConfirmations}{" "}
                confirmaciones válidas. Quedan {plan.daysRemaining} días
                calendario hasta el evento. El 100% inicial es un supuesto
                optimista, no una tasa observada.
              </p>
              {plan.exceedsPublishedCapacity && (
                <p className="font-medium text-foreground">
                  El escenario supera los 100 cupos publicados. Revisa capacidad
                  y compromiso de asistencia antes de ofrecer más lugares.
                </p>
              )}
              {plan.assumedBudget !== null && (
                <p className="font-medium text-foreground">
                  Presupuesto hipotético para cerrar la brecha:{" "}
                  {money.format(plan.assumedBudget)}. Es la brecha × tu costo
                  supuesto; no incluye gastos previos ni demuestra retorno por
                  canal.
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="effort-title" className="space-y-4">
            <h2 id="effort-title" className="text-xl font-semibold">
              Dónde concentrar el esfuerzo
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Action
                title="Contactar a los aceptados"
                count={current.onSiteAwaitingConfirmation}
              >
                Personas presenciales que aún no tienen una confirmación válida.
                Este es el grupo más cercano a cerrar la brecha.
              </Action>
              <Action title="Revisar resultados" count={current.reviewReady}>
                Postulaciones presenciales por decidir con un resultado
                clasificado en una versión vigente. Evalúa su admisión antes de
                invertir en más captación.
              </Action>
              <Action
                title="Activar postulaciones"
                count={current.needsChallenge}
              >
                Postulaciones presenciales enviadas sin resultado clasificado
                vigente. Además, hay {current.drafts} borradores presenciales.
              </Action>
            </div>
            <p className="text-sm text-muted-foreground">
              Incluso si todas las personas aceptadas pendientes confirman, el
              escenario necesita al menos {plan.additionalAcceptances}{" "}
              aceptaciones presenciales adicionales. Es un mínimo teórico, no
              una proyección de conversión.
            </p>
            <a className={link} href="/admin/participants">
              Abrir lista de participantes
            </a>
            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div>
                <h3 className="font-medium">
                  Señal de los últimos 7 días completos
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {current.firstConfirmationsLast7Days} primeras confirmaciones
                  fechadas entre quienes siguen confirmados presencialmente.{" "}
                  {current.confirmationTimingUnknown} confirmaciones actuales no
                  tienen una primera fecha fiable. Es un recuento parcial, no
                  una tasa de conversión ni un pronóstico.
                </p>
              </div>
              <div>
                <h3 className="font-medium">
                  Llegadas registradas: {current.recordedCheckIns}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No hay un proceso de check-in conectado en esta aplicación. La
                  ausencia de registros no prueba ausencia de asistentes. Hay{" "}
                  {current.remoteAccepted} aceptados remotos y{" "}
                  {current.unknownModeAccepted} sin modalidad; no cuentan hacia
                  la meta presencial.
                </p>
              </div>
            </div>
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer focus-visible:outline-2">
                Qué falta para decidir inversión por canal
              </summary>
              <p className="mt-2">
                La atribución está en PostHog y no está vinculada a este
                informe. Tampoco hay gasto publicitario registrado. Para
                comparar canales necesitamos unir participantes, fuente y gasto
                del mismo período. El costo del escenario es una estimación que
                ingresas, no un costo de adquisición medido.
              </p>
            </details>
          </section>

          <section
            aria-labelledby="history-title"
            className="space-y-5 border-t pt-8"
          >
            <div>
              <h2 id="history-title" className="text-2xl font-semibold">
                Personas por etapa a lo largo del tiempo
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Una etapa por persona, al cierre de cada día en Lima. Hoy es una
                observación parcial. Incluye cuentas sin postulación y salidas
                del proceso.
              </p>
            </div>
            <form
              action="/admin/insights/history#history-title"
              method="get"
              className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr_1.3fr_auto]"
            >
              <input type="hidden" name="showUp" value={query.showUpPercent} />
              {query.costPerConfirmation !== undefined && (
                <input
                  type="hidden"
                  name="cost"
                  value={query.costPerConfirmation}
                />
              )}
              <label className="grid min-w-0 gap-1.5 text-sm">
                Al cierre del día
                <input
                  className={field}
                  type="date"
                  name="end"
                  required
                  min="2020-01-01"
                  max={limaDay(new Date(query.now))}
                  defaultValue={query.end}
                />
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm">
                Período
                <select className={field} name="days" defaultValue={query.days}>
                  {[7, 14, 30, 90].map((days) => (
                    <option key={days} value={days}>
                      {days} días
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm">
                Residencia actual
                <select
                  className={field}
                  name="country"
                  defaultValue={countryFilterValue(query.country)}
                >
                  {countryFilterOptions(query.country).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm">
                Grupo por reto
                <select
                  className={field}
                  name="challenge"
                  defaultValue={query.challenge ?? ""}
                >
                  <option value="">Todas las personas</option>
                  {playableChallenges.map((challenge) => (
                    <option key={challenge.slug} value={challenge.slug}>
                      {challenge.theme}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={link}>
                Ver evolución
              </button>
            </form>
            <p className="text-sm font-medium">
              {countryScope} · {challengeScope}
            </p>
            <p className="text-sm text-muted-foreground">
              Se reconstruyen los registros conservados con residencia actual y
              versiones de retos vigentes hoy. El filtro de reto fija el grupo
              actual y muestra también sus etapas anteriores. Cambios de
              residencia, reglas o eliminaciones pueden cambiar esta
              reconstrucción.
            </p>

            {selected && (
              <div className="space-y-3">
                <h3 className="font-semibold">
                  {dateLabel(selected.date)}: {selected.people} personas
                  {selected.partial && " · parcial"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  El cambio compara con el día anterior. Si hoy está incluido,
                  se compara un día parcial con uno completo. Resolver
                  incertidumbre también cambia los recuentos; no todo cambio es
                  una transición nueva.
                </p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {historyStages.map((stage) => {
                    const count = selected.stages[stage];
                    const change = count - (previous?.stages[stage] ?? count);
                    let changeLabel = String(change);
                    if (change > 0) changeLabel = `+${change}`;
                    return (
                      <div key={stage} className="border p-3">
                        <p className="text-xs text-muted-foreground">
                          {stages[stage].label}
                        </p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">
                          {count}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {changeLabel}
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Altura máxima: {highest} personas. Selecciona una barra para
                consultar ese día.
              </p>
              <section
                aria-label="Gráfico diario de etapas, desplazable"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need focus to scroll the chart horizontally.
                tabIndex={0}
                className="overflow-x-auto border p-4 focus-visible:outline-2"
              >
                <div
                  className="flex items-end gap-2"
                  style={{ minWidth: Math.max(600, data.days.length * 34) }}
                >
                  {data.days.map((day) => (
                    <a
                      key={day.date}
                      href={dayHref(day.date)}
                      aria-label={`${dateLabel(day.date)}: ${day.people} personas, ${day.stages.unknown} con historial insuficiente`}
                      className="group flex min-w-0 flex-1 flex-col items-center gap-2 focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <span className="text-[10px] tabular-nums">
                        {day.people}
                      </span>
                      <span
                        aria-hidden="true"
                        className="flex h-52 w-full flex-col justify-end border-b"
                      >
                        {historyStages.map((stage) => (
                          <span
                            key={stage}
                            style={{
                              height: `${(day.stages[stage] / highest) * 100}%`,
                              backgroundColor: stages[stage].color,
                            }}
                            className="block w-full group-hover:opacity-75"
                          />
                        ))}
                      </span>
                      <span className="text-[10px] whitespace-nowrap">
                        {day.date.slice(8)}/{day.date.slice(5, 7)}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
              <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                {historyStages.map((stage) => (
                  <li className="flex items-center gap-1.5" key={stage}>
                    <span
                      className="inline-block size-3"
                      aria-hidden="true"
                      style={{ backgroundColor: stages[stage].color }}
                    />
                    {stages[stage].label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 border-l-4 border-muted-foreground pl-4 text-sm text-muted-foreground">
              <p>
                “Historial insuficiente” conserva a las personas cuyo estado no
                puede fecharse. No se usa la última edición como fecha de
                decisión o retiro. Actualmente hay{" "}
                {current.missingDecisionDates} decisiones sin fecha registrada
                en el conjunto global.
              </p>
              <p>
                Las confirmaciones antiguas pudieron cambiar de fecha al
                editarse. Antes de esa fecha se muestra incertidumbre.
                “Confirmación registrada” no prueba que todos los datos fueran
                válidos entonces ni que la persona asistiera presencialmente. La
                meta superior sí exige datos completos actuales.
              </p>
              <p>
                Las etapas de reto describen actividad en las versiones
                vigentes, no elegibilidad histórica. Revisión y lista de espera
                se agrupan con las etapas previas a la decisión porque sus
                fechas no están registradas.
              </p>
            </div>
            <details>
              <summary className="cursor-pointer font-medium focus-visible:outline-2">
                Ver tabla diaria con los valores exactos
              </summary>
              <section
                aria-label="Tabla diaria de etapas, desplazable"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need focus to scroll the table horizontally.
                tabIndex={0}
                className="mt-3 overflow-auto border focus-visible:outline-2"
              >
                <table className="w-full text-right text-sm [&_td]:border-t [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:py-3">
                  <caption className="p-3 text-left text-muted-foreground">
                    Personas únicas por día y etapa. Las columnas suman el
                    total, incluido el historial insuficiente.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="text-left">
                        Día de Lima
                      </th>
                      <th scope="col">Total</th>
                      {historyStages.map((stage) => (
                        <th key={stage} scope="col" className="min-w-28">
                          {stages[stage].label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.days.map((day) => (
                      <tr key={day.date}>
                        <th scope="row" className="whitespace-nowrap text-left">
                          {day.date}
                          {day.partial && " · parcial"}
                        </th>
                        <td>{day.people}</td>
                        {historyStages.map((stage) => (
                          <td key={stage}>{day.stages[stage]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </details>
          </section>
        </main>
      </BrandContainer>
    </BrandPage>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly note: string;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-4xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Action({
  title,
  count,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="border bg-card p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{count}</p>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
