import { playableChallenges } from "@chofex/challenges-contract";
import { countries, countryName } from "@chofex/registration-contract";
import {
  BrandContainer,
  BrandHeader,
  BrandKicker,
  BrandPage,
} from "@chofex/ui/components/brand";
import type { ReactNode } from "react";

import {
  type CandidateCountryFilter,
  candidateFilterQuery,
  countryFilterValue,
} from "@/lib/admin/candidate-filters";
import type { AdminInsights, InsightsFilters } from "@/lib/admin/insights";

const numbers = new Intl.NumberFormat("es-PE");
const percentages = new Intl.NumberFormat("es-PE", {
  style: "percent",
  maximumFractionDigits: 1,
});
const rate = (count: number, total: number): string => {
  const fraction = `${numbers.format(count)} / ${numbers.format(total)}`;
  if (total === 0) return `${fraction} · Sin base`;
  return `${fraction} · ${percentages.format(count / total)}`;
};
const countryLabel = (code: string | null) => {
  if (code === null) return "Sin país registrado";
  return countryName(code);
};
const countryFilter = (code: string | null): CandidateCountryFilter => {
  if (code === null) return { kind: "unknown" };
  return { kind: "country", code };
};
const challengeLabel = (slug: string) =>
  playableChallenges.find((challenge) => challenge.slug === slug)?.theme ??
  slug;
const participantsHref = (filters: InsightsFilters): string => {
  const query = candidateFilterQuery({ page: 1, query: "", ...filters });
  return `/admin/participants${query ? `?${query}` : ""}`;
};
const linkClass =
  "underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4";
const tableClass =
  "w-full text-left text-sm tabular-nums [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3 [&_thead]:bg-muted/50 [&_tbody_tr]:border-t [&_tbody_tr]:border-border";

function TableRegion({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable tables need keyboard focus for horizontal scrolling.
      tabIndex={0}
      aria-label={label}
      className="overflow-x-auto rounded-xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </section>
  );
}

function ShareBar({
  count,
  total,
}: {
  readonly count: number;
  readonly total: number;
}) {
  const width = total === 0 ? 0 : (count / total) * 100;
  return (
    <div
      aria-hidden="true"
      className="h-2 overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function ParticipantInsights({
  data,
  filters,
}: {
  readonly data: AdminInsights;
  readonly filters: InsightsFilters;
}) {
  const { totals } = data;
  let countryScope = "Todos los países";
  if (filters.country?.kind === "unknown") countryScope = "Sin país registrado";
  if (filters.country?.kind === "country")
    countryScope = countryName(filters.country.code);
  let challengeScope = "Todas las personas, con o sin actividad en retos";
  if (filters.challenge)
    challengeScope = `Personas que iniciaron ${challengeLabel(filters.challenge)}, en su versión vigente`;
  const milestones = [
    { label: "Postulación iniciada", count: totals.people },
    { label: "Postulación enviada", count: totals.submitted },
    { label: "Reto iniciado", count: totals.challengeStarted },
    { label: "Reto evaluado", count: totals.challengeCompleted },
  ];

  return (
    <BrandPage>
      <BrandHeader>
        <span className="font-semibold">Administración</span>
        <a className={linkClass} href={participantsHref(filters)}>
          Ver participantes
        </a>
      </BrandHeader>
      <BrandContainer>
        <main className="space-y-10 py-8 sm:py-12">
          <header className="space-y-4">
            <BrandKicker>Estadísticas</BrandKicker>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Estadísticas de participantes
            </h1>
            <p className="text-muted-foreground">
              {countryScope} · {challengeScope}.
            </p>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Cada persona cuenta una vez, según su última postulación. Incluye
              postulaciones rechazadas; excluye las retiradas y las personas sin
              postulación. El país es el de residencia actual. La búsqueda, el
              estado y el orden de la lista no limitan este informe.
            </p>
          </header>

          <form
            action="/admin/insights"
            method="get"
            className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-5"
          >
            <div className="min-w-0 flex-1 basis-56 space-y-2">
              <label
                htmlFor="insights-country"
                className="block text-sm font-medium"
              >
                País de residencia
              </label>
              <select
                id="insights-country"
                name="country"
                defaultValue={countryFilterValue(filters.country)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <option value="">Todos los países</option>
                <option value="unknown">Sin país registrado</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1 basis-64 space-y-2">
              <label
                htmlFor="insights-challenge"
                className="block text-sm font-medium"
              >
                Personas que iniciaron el reto
              </label>
              <select
                id="insights-challenge"
                name="challenge"
                defaultValue={filters.challenge ?? ""}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <option value="">Todas las personas</option>
                {data.challenges.map(({ slug }) => (
                  <option key={slug} value={slug}>
                    {challengeLabel(slug)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-10 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Aplicar
            </button>
            <a href="/admin/insights" className={`py-2 text-sm ${linkClass}`}>
              Restablecer filtros
            </a>
          </form>

          <section aria-labelledby="insights-total" className="space-y-2">
            <h2
              id="insights-total"
              className="text-sm font-medium text-muted-foreground"
            >
              Personas con postulación vigente o rechazada
            </h2>
            <p className="text-5xl font-semibold tabular-nums">
              {numbers.format(totals.people)}
            </p>
            {totals.people === 0 && (
              <p>
                No hay participantes con estos filtros.{" "}
                <a href="/admin/insights" className={linkClass}>
                  Restablecer filtros
                </a>
              </p>
            )}
          </section>

          <section aria-labelledby="insights-milestones" className="space-y-5">
            <h2 id="insights-milestones" className="text-xl font-semibold">
              Hitos registrados
            </h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Son hitos independientes, no etapas consecutivas. Una nueva
              postulación puede conservar un reto evaluado. Cada porcentaje usa
              el total de personas de este informe. Las decisiones no implican
              un envío ni una evaluación. Sin filtro de reto, los hitos cuentan
              cualquier reto disponible en su versión vigente.
            </p>
            {filters.challenge && (
              <p className="text-sm text-muted-foreground">
                Los hitos de retos se refieren solo a{" "}
                {challengeLabel(filters.challenge)}. Iniciar ese reto define
                este grupo y representa el 100 % cuando hay personas.
              </p>
            )}
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-5 rounded-xl border border-border p-5">
                {milestones.map(({ label, count }) => (
                  <div key={label} className="space-y-2">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span>{label}</span>
                      <span className="tabular-nums">
                        {rate(count, totals.people)}
                      </span>
                    </div>
                    <ShareBar count={count} total={totals.people} />
                  </div>
                ))}
              </div>
              <div className="space-y-4 rounded-xl border border-border p-5">
                <h3 className="font-medium">
                  Decisiones de la última postulación
                </h3>
                <p className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>Aprobadas</span>
                  <span className="tabular-nums">
                    {rate(totals.approved, totals.people)}
                  </span>
                </p>
                <p className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>Rechazadas</span>
                  <span className="tabular-nums">
                    {rate(totals.rejected, totals.people)}
                  </span>
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="insights-countries" className="space-y-4">
            <h2 id="insights-countries" className="text-xl font-semibold">
              Distribución por país
            </h2>
            <TableRegion label="Distribución por país, tabla desplazable">
              <table className={tableClass}>
                <caption className="p-4 text-left text-sm text-muted-foreground">
                  Personas únicas por país. La proporción usa el total del
                  informe; la tasa de envío usa el total de cada país.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">País</th>
                    <th scope="col">Personas / total</th>
                    <th scope="col">Enviadas / personas</th>
                    <th scope="col">Iniciaron reto</th>
                    <th scope="col">Reto evaluado</th>
                    <th scope="col">Aprobadas</th>
                    <th scope="col">Rechazadas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.countries.map((country) => (
                    <tr key={country.countryCode ?? "unknown"}>
                      <th scope="row" className="font-medium">
                        <a
                          className={linkClass}
                          href={participantsHref({
                            ...filters,
                            country: countryFilter(country.countryCode),
                          })}
                        >
                          {countryLabel(country.countryCode)}
                        </a>
                      </th>
                      <td className="min-w-40">
                        <div className="mb-2 whitespace-nowrap">
                          {rate(country.people, totals.people)}
                        </div>
                        <ShareBar
                          count={country.people}
                          total={totals.people}
                        />
                      </td>
                      <td className="whitespace-nowrap">
                        {rate(country.submitted, country.people)}
                      </td>
                      <td>{numbers.format(country.challengeStarted)}</td>
                      <td>{numbers.format(country.challengeCompleted)}</td>
                      <td>{numbers.format(country.approved)}</td>
                      <td>{numbers.format(country.rejected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
          </section>

          <section aria-labelledby="insights-challenges" className="space-y-4">
            <h2 id="insights-challenges" className="text-xl font-semibold">
              Comparación de retos
            </h2>
            <TableRegion label="Comparación de retos, tabla desplazable">
              <table className={tableClass}>
                <caption className="p-4 text-left text-sm text-muted-foreground">
                  Versiones vigentes de todos los retos disponibles, dentro del
                  grupo seleccionado. Una persona puede aparecer en varias
                  filas; no se suman como personas únicas. Los enlaces conservan
                  el país y abren el grupo de personas que inició el reto.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Reto</th>
                    <th scope="col">Iniciaron</th>
                    <th scope="col">Sin evaluación</th>
                    <th scope="col">Evaluados</th>
                    <th scope="col">Evaluados / iniciaron</th>
                  </tr>
                </thead>
                <tbody>
                  {data.challenges.map((challenge) => {
                    let title: ReactNode = challengeLabel(challenge.slug);
                    if (
                      !filters.challenge ||
                      filters.challenge === challenge.slug
                    ) {
                      title = (
                        <a
                          className={linkClass}
                          href={participantsHref({
                            country: filters.country,
                            challenge: challenge.slug,
                          })}
                        >
                          {title}
                        </a>
                      );
                    }
                    return (
                      <tr key={challenge.slug}>
                        <th scope="row" className="font-medium">
                          {title}
                        </th>
                        <td>{numbers.format(challenge.started)}</td>
                        <td>
                          {numbers.format(
                            challenge.started - challenge.completed,
                          )}
                        </td>
                        <td>{numbers.format(challenge.completed)}</td>
                        <td className="whitespace-nowrap">
                          {rate(challenge.completed, challenge.started)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableRegion>
          </section>

          <section aria-labelledby="insights-matrix" className="space-y-4">
            <h2 id="insights-matrix" className="text-xl font-semibold">
              País × reto
            </h2>
            <TableRegion label="País por reto, tabla desplazable">
              <table className={tableClass}>
                <caption className="p-4 text-left text-sm text-muted-foreground">
                  Cada celda muestra evaluados / iniciaron y su porcentaje
                  dentro del grupo seleccionado. Sin base significa que nadie
                  inició ese reto. Desplaza la tabla horizontalmente para ver
                  todos los retos.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">País</th>
                    {data.challenges.map(({ slug }) => (
                      <th scope="col" key={slug}>
                        {challengeLabel(slug)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.countries.map((country) => (
                    <tr key={country.countryCode ?? "unknown"}>
                      <th scope="row" className="font-medium">
                        {countryLabel(country.countryCode)}
                      </th>
                      {data.challenges.map(({ slug }) => {
                        const cell = data.countryChallenges.find(
                          (entry) =>
                            entry.countryCode === country.countryCode &&
                            entry.slug === slug,
                        );
                        return (
                          <td key={slug} className="whitespace-nowrap">
                            {rate(cell?.completed ?? 0, cell?.started ?? 0)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
          </section>
        </main>
      </BrandContainer>
    </BrandPage>
  );
}
