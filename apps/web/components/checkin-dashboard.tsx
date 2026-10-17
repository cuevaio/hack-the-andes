"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  type CheckinParticipant,
  type CheckinSort,
  CheckinSortSchema,
  type CheckinStatus,
  CheckinStatusSchema,
} from "@/lib/admin/checkin-contract";
import {
  checkinRosterKey,
  confirmCheckinArrival,
  fetchCheckinRoster,
} from "@/lib/admin/checkin-queries";
import { visibleCheckinParticipants } from "@/lib/admin/checkin-search";
import { CheckinDesk } from "./checkin-desk";

const button =
  "min-h-11 whitespace-nowrap rounded-md border px-4 py-2 text-sm disabled:opacity-50";
const field =
  "min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm";
const arrivalTime = (value: string) =>
  new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(new Date(value));

function ArrivalStatus({ checkedInAt }: { checkedInAt: string | null }) {
  if (checkedInAt === null)
    return <p className="text-sm text-muted-foreground">Sin check-in</p>;
  return (
    <p className="text-sm font-medium">
      Ya ingresó ·{" "}
      <time dateTime={checkedInAt}>{arrivalTime(checkedInAt)}</time>
    </p>
  );
}

export function CheckinPerson({
  participant,
}: {
  participant: CheckinParticipant;
}) {
  return (
    <div className="flex items-start gap-4">
      {participant.pictureUrl && (
        <Image
          unoptimized
          src={participant.pictureUrl}
          width={72}
          height={72}
          className="h-18 w-18 shrink-0 rounded-lg object-cover"
          alt={`Foto de ${participant.name}`}
          referrerPolicy="no-referrer"
        />
      )}
      <div className="min-w-0 space-y-1">
        <h3 className="break-words text-lg font-semibold">
          {participant.name}
        </h3>
        {participant.legalName &&
          participant.legalName !== participant.name && (
            <p className="break-words text-sm">{participant.legalName}</p>
          )}
        <p className="break-all text-sm text-muted-foreground">
          {participant.email || "Sin correo registrado"}
        </p>
        {participant.document.status === "available" && (
          <p className="font-mono text-sm">
            DNI / documento: •••• {participant.document.lastFour}
          </p>
        )}
        {participant.document.status === "not-provided" && (
          <p className="text-sm text-muted-foreground">Documento pendiente</p>
        )}
        {participant.document.status === "unavailable" && (
          <p className="text-sm text-muted-foreground">
            Documento no disponible. Busca por nombre o correo.
          </p>
        )}
      </div>
    </div>
  );
}

export function CheckinDashboard() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<CheckinStatus>("not-checked-in");
  const [sort, setSort] = useState<CheckinSort>("name-asc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: [...checkinRosterKey, debouncedSearch],
    queryFn: ({ signal }) => fetchCheckinRoster(debouncedSearch, signal),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: checkinRosterKey });
  }, [client]);
  const openQr = useCallback(() => setQrOpen(true), []);
  const participants = query.data?.participants ?? [];
  const selected = participants.find(
    (participant) => participant.applicationId === selectedId,
  );
  const mutation = useMutation({
    mutationFn: confirmCheckinArrival,
    onSuccess: ({ applicationId }) => {
      const participant = participants.find(
        (person) => person.applicationId === applicationId,
      );
      setNotice(`Llegada confirmada: ${participant?.name ?? "participante"}.`);
      setSelectedId(null);
      refresh();
    },
    onError: refresh,
  });
  const searching = search.trim() !== debouncedSearch || query.isPending;
  const blocked = mutation.isPending || searching || query.isError;
  const visible = visibleCheckinParticipants(participants, status, sort);
  const counts = query.data?.counts;
  return (
    <main className="ph-no-capture mx-auto max-w-5xl space-y-6 px-4 py-7 sm:px-6 sm:py-10">
      <nav className="flex flex-wrap gap-5 text-sm">
        <Link className="underline" href="/admin">
          Postulaciones
        </Link>
        <Link className="underline" href="/admin/event">
          Control del evento
        </Link>
        <Link className="underline" href="/teams">
          Equipos
        </Link>
      </nav>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Ingreso de participantes</h1>
        <p className="text-muted-foreground">
          Busca a la persona, comprueba su identidad y confirma su llegada. La
          lista se actualiza cada diez segundos.
        </p>
      </header>
      {counts && (
        <section
          aria-label="Resumen de asistencia"
          className="grid grid-cols-3 gap-2 sm:gap-4"
        >
          <div className="rounded-xl border p-3 sm:p-5">
            <p className="text-2xl font-semibold">{counts.total}</p>
            <p className="text-sm text-muted-foreground">Aceptados</p>
          </div>
          <div className="rounded-xl border p-3 sm:p-5">
            <p className="text-2xl font-semibold">{counts.checkedIn}</p>
            <p className="text-sm text-muted-foreground">Con check-in</p>
          </div>
          <div className="rounded-xl border p-3 sm:p-5">
            <p className="text-2xl font-semibold">{counts.pending}</p>
            <p className="text-sm text-muted-foreground">Sin check-in</p>
          </div>
        </section>
      )}
      <details
        open={qrOpen}
        onToggle={(event) => setQrOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer py-2 text-sm underline underline-offset-4">
          Usar código QR
        </summary>
        <div className="mt-3">
          <CheckinDesk onConfirmed={refresh} onCodeDetected={openQr} />
        </div>
      </details>
      <section
        aria-label="Buscar y filtrar participantes"
        className="space-y-4 rounded-xl border p-4 sm:p-5"
      >
        <label className="block space-y-2 text-sm">
          <span>Buscar por nombre, correo o DNI</span>
          <input
            type="search"
            className={field}
            autoComplete="off"
            spellCheck={false}
            maxLength={200}
            value={search}
            placeholder="Nombre, correo o documento"
            disabled={mutation.isPending}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedId(null);
            }}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm">
            <span>Estado de ingreso</span>
            <select
              className={field}
              value={status}
              disabled={mutation.isPending}
              onChange={(event) => {
                setStatus(
                  Schema.decodeUnknownSync(CheckinStatusSchema)(
                    event.target.value,
                  ),
                );
                setSelectedId(null);
              }}
            >
              <option value="all">Todos</option>
              <option value="not-checked-in">Sin check-in</option>
              <option value="checked-in">Con check-in</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span>Ordenar por</span>
            <select
              className={field}
              value={sort}
              disabled={mutation.isPending}
              onChange={(event) => {
                setSort(
                  Schema.decodeUnknownSync(CheckinSortSchema)(
                    event.target.value,
                  ),
                );
                setSelectedId(null);
              }}
            >
              <option value="name-asc">Nombre: A a Z</option>
              <option value="name-desc">Nombre: Z a A</option>
              <option value="arrival-desc">Check-in más reciente</option>
              <option value="arrival-asc">Check-in más antiguo</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className={button}
            type="button"
            disabled={!search || mutation.isPending}
            onClick={() => {
              setSearch("");
              setSelectedId(null);
            }}
          >
            Limpiar búsqueda
          </button>
          <button
            className={button}
            type="button"
            disabled={query.isFetching || mutation.isPending}
            onClick={refresh}
          >
            Actualizar lista
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          El documento se busca de forma segura. En los resultados solo se
          muestran sus últimos cuatro caracteres.
        </p>
      </section>
      {notice && (
        <p role="status" className="rounded-lg border p-4">
          {notice}
        </p>
      )}
      {mutation.isError && <p role="alert">{mutation.error.message}</p>}
      {query.isError && (
        <p role="alert">
          No se pudo actualizar la lista. Vuelve a intentarlo antes de confirmar
          una llegada.
        </p>
      )}
      {searching && <p role="status">Buscando participantes…</p>}
      {counts && counts.confirmationRequired > 0 && (
        <p className="text-sm text-muted-foreground">
          Confirmaciones de asistencia pendientes: {counts.confirmationRequired}
          . Deben completarse antes del check-in.
        </p>
      )}
      {!searching && !query.isError && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {visible.length} resultados
        </p>
      )}
      {!searching && !query.isError && visible.length === 0 && (
        <p className="rounded-xl border p-6">
          No hay participantes que coincidan con esta búsqueda y filtro.
        </p>
      )}
      <h2 className="text-xl font-semibold">Participantes</h2>
      <div
        className="grid items-start gap-4 sm:grid-cols-2"
        aria-busy={searching}
      >
        {!searching &&
          visible.map((participant) => (
            <article
              key={participant.applicationId}
              className="space-y-4 rounded-xl border p-4 sm:p-5"
            >
              <CheckinPerson participant={participant} />
              <ArrivalStatus checkedInAt={participant.checkedInAt} />
              {participant.eligibility === "confirmation-required" && (
                <p className="text-sm">
                  Falta confirmar asistencia. Pide que complete{" "}
                  <code>andes confirm</code>.
                </p>
              )}
              {participant.checkedInAt === null &&
                participant.eligibility === "ready" && (
                  <button
                    className={button}
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      setSelectedId(participant.applicationId);
                      mutation.reset();
                      setNotice("");
                    }}
                  >
                    Registrar llegada
                  </button>
                )}
              {selected?.applicationId === participant.applicationId && (
                <section
                  className="space-y-3 rounded-lg bg-muted p-4"
                  aria-label={`Confirmar llegada de ${participant.name}`}
                >
                  <h4 className="font-semibold">
                    Confirmar llegada de {participant.name}
                  </h4>
                  <p className="text-sm">
                    Comprueba que está presente y que su foto, nombre y
                    documento coinciden. Esta acción registra su ingreso al
                    evento.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className={`${button} bg-primary text-primary-foreground`}
                      type="button"
                      disabled={
                        blocked ||
                        participant.checkedInAt !== null ||
                        participant.eligibility !== "ready"
                      }
                      onClick={() => mutation.mutate(participant.applicationId)}
                    >
                      {mutation.isPending
                        ? "Confirmando…"
                        : "Confirmar llegada"}
                    </button>
                    <button
                      className={button}
                      type="button"
                      disabled={mutation.isPending}
                      onClick={() => setSelectedId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </section>
              )}
            </article>
          ))}
      </div>
    </main>
  );
}
