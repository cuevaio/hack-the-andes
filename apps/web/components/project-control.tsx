"use client";

import {
  type ProjectDashboard,
  ProjectDashboardSchema,
} from "@chofex/registration-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import Link from "next/link";
import { useState } from "react";
import { ProjectDetails, ProjectTimestamp } from "@/components/project-details";

async function projectRequest(init?: RequestInit) {
  const response = await fetch("/api/admin/projects", {
    ...init,
    cache: "no-store",
  });
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      "No se pudieron actualizar los proyectos. Vuelve a intentarlo.",
    );
  const envelope = Schema.decodeUnknownSync(
    Schema.Struct({ ok: Schema.Literal(true), data: ProjectDashboardSchema }),
  )(body);
  return envelope.data;
}

export function ProjectControl({
  initialData,
}: {
  initialData: ProjectDashboard;
}) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["event-projects"],
    queryFn: () => projectRequest(),
    initialData,
    refetchInterval: 15_000,
  });
  const mutation = useMutation({
    mutationFn: (
      settings: { galleryVisible: boolean } | { submissionsOpen: boolean },
    ) =>
      projectRequest({
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      }),
    onSuccess: (data) => client.setQueryData(["event-projects"], data),
  });
  const { visible, submissionsOpen, projects, archives } = query.data;
  const filtered = projects.filter((project) =>
    project.teamName
      .toLocaleLowerCase("es")
      .includes(search.toLocaleLowerCase("es")),
  );
  let label = "Publicar galería";
  if (visible) label = "Ocultar galería";
  return (
    <section className="space-y-6">
      <div className="space-y-4 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">
          Entregas de proyectos: {submissionsOpen ? "abiertas" : "cerradas"}
        </h2>
        <p className="text-muted-foreground">
          Al cerrar, los equipos no podrán enviar ni editar sus entregas ni
          publicar actualizaciones en sus bitácoras.
        </p>
        <button
          className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          type="button"
          disabled={mutation.isPending || query.isError}
          onClick={() => mutation.mutate({ submissionsOpen: !submissionsOpen })}
        >
          {submissionsOpen ? "Cerrar entregas" : "Abrir entregas"}
        </button>
      </div>
      <div className="space-y-4 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">
          Galería de proyectos: {visible ? "pública" : "oculta"}
        </h2>
        <p className="text-muted-foreground">
          La apertura es manual, sin horario programado. Al publicar, cualquier
          persona podrá ver los proyectos enviados y sus bitácoras.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            type="button"
            disabled={mutation.isPending || query.isError}
            onClick={() => mutation.mutate({ galleryVisible: !visible })}
          >
            {label}
          </button>
          <Link className="underline" href="/projects">
            Ver galería
          </Link>
        </div>
        {mutation.isError && <p role="alert">{mutation.error.message}</p>}
        {query.isError && (
          <p role="alert">
            No se pudo consultar el estado actual. Espera la reconexión antes de
            cambiarlo.
          </p>
        )}
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Proyectos y bitácoras</h2>
        <p className="text-sm text-muted-foreground">
          {projects.filter((project) => project.submission !== null).length}{" "}
          proyectos enviados de {projects.length} equipos. Esta revisión incluye
          equipos que todavía no enviaron su proyecto.
        </p>
        <label className="block space-y-2 text-sm">
          <span>Buscar equipo</span>
          <input
            className="block w-full rounded-md border bg-background px-3 py-2"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {filtered.length === 0 && <p>No hay equipos que coincidan.</p>}
      <div className="space-y-4">
        {filtered.map((project) => (
          <details key={project.teamId} className="rounded-xl border p-5">
            <summary className="cursor-pointer break-words font-semibold">
              {project.teamName}
              <span className="ml-3 text-sm font-normal text-muted-foreground">
                {project.submission ? "Enviado" : "Sin entrega"} ·{" "}
                {project.updateCount} avances
              </span>
            </summary>
            <div className="mt-6">
              <ProjectDetails project={project} />
            </div>
          </details>
        ))}
      </div>
      {archives.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Equipos disueltos</h2>
          <p className="text-sm text-muted-foreground">
            Archivo privado de entregas y bitácoras. No aparece en la galería
            pública.
          </p>
          {archives
            .filter(({ project }) =>
              project.teamName
                .toLocaleLowerCase("es")
                .includes(search.toLocaleLowerCase("es")),
            )
            .map(({ project, archivedAt }) => (
              <details key={project.teamId} className="rounded-xl border p-5">
                <summary className="cursor-pointer break-words font-semibold">
                  {project.teamName} · Archivado{" "}
                  <ProjectTimestamp value={archivedAt} />
                </summary>
                <div className="mt-6">
                  <ProjectDetails project={project} />
                </div>
              </details>
            ))}
        </section>
      )}
    </section>
  );
}
