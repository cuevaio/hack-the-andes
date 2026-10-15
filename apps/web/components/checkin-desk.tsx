"use client";

import {
  type CheckinPreview,
  CheckinPreviewSchema,
} from "@chofex/registration-contract";
import { Schema } from "effect";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export function CheckinDesk() {
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState<CheckinPreview | null>(null);
  const [previewToken, setPreviewToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);
  const request = useCallback(async (code: string, confirm: boolean) => {
    const sequence = ++latestRequest.current;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: code, confirm }),
        cache: "no-store",
      });
      const body = await response.json();
      if (sequence !== latestRequest.current) return;
      if (!response.ok || !body.ok)
        throw new Error(
          body.error?.message ?? "No se pudo verificar el check-in.",
        );
      setPreview(Schema.decodeUnknownSync(CheckinPreviewSchema)(body.data));
      setPreviewToken(code);
    } catch (error) {
      if (sequence !== latestRequest.current) return;
      setPreview(null);
      setPreviewToken("");
      let message = "No se pudo verificar el check-in.";
      if (error instanceof Error) message = error.message;
      setError(message);
    } finally {
      if (sequence === latestRequest.current) setPending(false);
    }
  }, []);
  useEffect(() => {
    const readCode = () => {
      const code = new URLSearchParams(window.location.hash.slice(1)).get(
        "token",
      );
      if (!code) return;
      window.history.replaceState(null, "", window.location.pathname);
      setToken(code);
      setPreview(null);
      setPreviewToken("");
      void request(code, false);
    };
    readCode();
    window.addEventListener("hashchange", readCode);
    return () => window.removeEventListener("hashchange", readCode);
  }, [request]);
  return (
    <main className="mx-auto max-w-lg space-y-7 px-5 py-10">
      <nav className="flex gap-5 text-sm">
        <Link className="underline" href="/admin/event">
          Control del evento
        </Link>
        <Link className="underline" href="/teams">
          Equipos
        </Link>
      </nav>
      <h1 className="text-3xl font-semibold">Check-in de participantes</h1>
      <p className="text-muted-foreground">
        Inicia sesión antes de escanear. Usa la cámara de tu teléfono para abrir
        el QR de <code>andes checkin</code>, o ingresa el código alternativo.
        Escanear no confirma la llegada: verifica la identidad y confirma abajo.
      </p>
      <form
        className="ph-no-capture space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void request(token, false);
        }}
      >
        <label className="flex flex-col gap-2 text-sm">
          Código de check-in
          <input
            className="rounded-md border bg-background px-3 py-2 font-mono"
            autoComplete="off"
            spellCheck={false}
            value={token}
            disabled={pending}
            onChange={(e) => {
              setToken(e.target.value);
              setPreview(null);
              setPreviewToken("");
            }}
          />
        </label>
        <button
          className="whitespace-nowrap rounded-md border px-4 py-2 disabled:opacity-50"
          disabled={pending || !token}
          type="submit"
        >
          Verificar código
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {pending && <p role="status">Verificando…</p>}
      {preview && (
        <section className="space-y-4 rounded-xl border p-6">
          {preview.pictureUrl && (
            <Image
              width={144}
              height={144}
              unoptimized
              className="h-36 w-36 rounded-xl object-cover"
              src={preview.pictureUrl}
              alt={`Foto confirmada de ${preview.name}`}
              referrerPolicy="no-referrer"
            />
          )}
          <h2 className="text-2xl font-semibold">{preview.name}</h2>
          {preview.checkedIn && (
            <p role="status">Check-in confirmado. Puede ingresar.</p>
          )}
          {!preview.checkedIn && (
            <>
              <p>
                Comprueba que esta persona está presente y coincide con el
                perfil.
              </p>
              <button
                className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                type="button"
                disabled={pending || previewToken !== token}
                onClick={() => void request(previewToken, true)}
              >
                Confirmar llegada
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
