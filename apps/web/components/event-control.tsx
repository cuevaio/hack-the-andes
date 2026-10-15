"use client";

import type { TeamDashboard } from "@chofex/registration-contract";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { dashboardRequest } from "./team-dashboard";

export function EventControl({ initialData }: { initialData: TeamDashboard }) {
  const query = useQuery({
    queryKey: ["event-teams", "/api/admin/teams"],
    queryFn: () => dashboardRequest("/api/admin/teams"),
    initialData,
    refetchInterval: 10_000,
  });
  const mutation = useMutation({
    mutationFn: (selectionOpen: boolean) =>
      dashboardRequest("/api/admin/teams", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selectionOpen }),
      }),
    onSuccess: () => query.refetch(),
  });
  const open = query.data.selectionOpen;
  let label = "Abrir selección de tracks";
  if (open) label = "Cerrar selección de tracks";
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-5 py-10">
      <nav className="flex flex-wrap gap-5 text-sm">
        <Link className="underline" href="/admin/participants">
          Participantes
        </Link>
        <Link className="underline" href="/teams">
          Equipos
        </Link>
        <Link className="underline" href="/tracks">
          Tracks
        </Link>
        <Link className="underline" href="/admin/checkin">
          Check-in
        </Link>
      </nav>
      <h1 className="text-3xl font-semibold">Control del evento</h1>
      <section className="space-y-4 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">
          Selección de tracks: {open ? "abierta" : "cerrada"}
        </h2>
        <p className="text-muted-foreground">
          No hay apertura programada. Al abrir, los equipos presentes podrán
          elegir o cambiar track. Al cerrar, conservarán su selección actual. La
          creación de equipos y los cambios de integrantes siguen disponibles.
        </p>
        <button
          className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          type="button"
          disabled={mutation.isPending || query.isError}
          onClick={() => mutation.mutate(!open)}
        >
          {label}
        </button>
        {mutation.isError && <p role="alert">{mutation.error.message}</p>}
        {query.isError && (
          <p role="alert">
            No se pudo consultar el estado actual. Espera la reconexión antes de
            cambiarlo.
          </p>
        )}
      </section>
    </main>
  );
}
