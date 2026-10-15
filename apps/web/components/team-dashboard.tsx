"use client";

import {
  type Team,
  type TeamDashboard,
  TeamDashboardSchema,
  trackNames,
  tracks,
} from "@chofex/registration-contract";
import { useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import Link from "next/link";
import { useState } from "react";

export async function dashboardRequest(endpoint: string, init?: RequestInit) {
  const response = await fetch(endpoint, { ...init, cache: "no-store" });
  const body = await response.json();
  if (!response.ok || !body.ok)
    throw new Error(body.error?.message ?? "No se pudo actualizar el evento.");
  return Schema.decodeUnknownSync(TeamDashboardSchema)(body.data);
}

function TeamCard({ team, nested = false }: { team: Team; nested?: boolean }) {
  const Heading = nested ? "h3" : "h2";
  let track = "Sin track";
  if (team.track) track = trackNames[team.track];
  return (
    <article className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Heading className="break-words font-semibold">{team.name}</Heading>
        <span className="shrink-0 text-sm text-muted-foreground">
          {team.members.length}/4
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{track}</p>
      <ul className="mt-4 space-y-2">
        {team.members.map((member) => (
          <li
            key={member.id}
            className="flex flex-wrap justify-between gap-2 text-sm"
          >
            <span>{member.name}</span>
            <span className="text-muted-foreground">
              {member.checkedIn ? "Presente" : "Sin check-in"}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function TeamDashboardView({
  initialData,
  admin,
  view,
}: {
  initialData: TeamDashboard;
  admin: boolean;
  view: "teams" | "tracks";
}) {
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("all");
  let endpoint = "/api/v1/teams";
  if (admin) endpoint = "/api/admin/teams";
  const query = useQuery({
    queryKey: ["event-teams", endpoint],
    queryFn: () => dashboardRequest(endpoint),
    initialData,
    refetchInterval: 10_000,
  });
  const data = query.data;
  const teams = data.teams.filter((team) => {
    if (trackFilter === "none" && team.track !== null) return false;
    if (
      trackFilter !== "all" &&
      trackFilter !== "none" &&
      team.track !== trackFilter
    )
      return false;
    const text = [team.name, ...team.members.map((m) => m.name)]
      .join(" ")
      .toLocaleLowerCase("es");
    return text.includes(search.toLocaleLowerCase("es"));
  });
  const participants = data.teams.reduce(
    (total, team) => total + team.members.length,
    0,
  );
  let updateStatus = "Actualización automática cada 10 segundos.";
  if (query.isError) {
    updateStatus =
      "No se pudo actualizar. Los datos mostrados pueden estar desactualizados.";
  }
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-10">
      <header className="space-y-4">
        <nav className="flex flex-wrap gap-5 text-sm">
          <Link className="underline" href="/teams">
            Equipos
          </Link>
          <Link className="underline" href="/tracks">
            Tracks
          </Link>
          {admin && (
            <Link className="underline" href="/admin/event">
              Control del evento
            </Link>
          )}
          <Link className="underline" href="/welcome">
            Mi participación
          </Link>
        </nav>
        <div>
          <p className="text-sm text-muted-foreground">
            Hack the Andes · Vista de solo lectura
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            {view === "teams" ? "Equipos" : "Equipos por track"}
          </h1>
        </div>
        <p>
          {data.teams.length}/36 equipos · {participants} participantes en
          equipo · {data.unassigned.length} sin equipo ·{" "}
          {data.teams.filter((t) => !t.track).length} equipos sin track
        </p>
        <p className="text-sm text-muted-foreground">
          Selección de tracks: {data.selectionOpen ? "abierta" : "cerrada"}. Los
          equipos se gestionan exclusivamente con <code>andes team</code>.
        </p>
        <p className="text-sm text-muted-foreground" role="status">
          {updateStatus}
        </p>
      </header>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Buscar equipo o integrante
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
          />
        </label>
        {view === "teams" && (
          <label className="flex flex-col gap-1 text-sm">
            Track
            <select
              className="rounded-md border bg-background px-3 py-2"
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="none">Sin track</option>
              {tracks.map((track) => (
                <option key={track} value={track}>
                  {trackNames[track]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {view === "teams" && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
          {!teams.length && <p>No hay equipos para mostrar.</p>}
        </section>
      )}
      {view === "tracks" && (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            {tracks.map((track) => {
              const all = data.teams.filter((t) => t.track === track);
              return (
                <section key={track} className="space-y-4">
                  <h2 className="text-xl font-semibold">{trackNames[track]}</h2>
                  <p className="text-sm text-muted-foreground">
                    {all.length}/12 equipos ·{" "}
                    {all.reduce((sum, t) => sum + t.members.length, 0)}{" "}
                    participantes
                  </p>
                  {teams
                    .filter((t) => t.track === track)
                    .map((team) => (
                      <TeamCard key={team.id} team={team} nested />
                    ))}
                </section>
              );
            })}
          </div>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Sin track</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {teams
                .filter((t) => !t.track)
                .map((team) => (
                  <TeamCard key={team.id} team={team} nested />
                ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
