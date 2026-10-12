"use client";

import { useEffect, useState } from "react";

const deadline = "2026-10-14T20:00:00-05:00";
const deadlineMs = Date.parse(deadline);

export function GameCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    function update() {
      setRemaining(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
    }
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  let countdown = (
    <p className="mt-4 text-sm text-muted-foreground">
      Cargando cuenta regresiva…
    </p>
  );
  if (remaining !== null && remaining > 0) {
    const units = [
      { label: "Días", value: Math.floor(remaining / 86400) },
      { label: "Horas", value: Math.floor((remaining % 86400) / 3600) },
      { label: "Minutos", value: Math.floor((remaining % 3600) / 60) },
      { label: "Segundos", value: remaining % 60 },
    ];
    countdown = (
      <div
        aria-label="Tiempo restante para enviar tu juego"
        aria-live="off"
        className="mt-4 grid grid-cols-4 gap-3"
        role="timer"
      >
        {units.map((unit) => (
          <div key={unit.label}>
            <span className="block font-mono text-3xl tabular-nums text-[var(--hud-accent)] sm:text-4xl">
              {String(unit.value).padStart(2, "0")}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {unit.label}
            </span>
          </div>
        ))}
      </div>
    );
  } else if (remaining === 0) {
    countdown = (
      <p
        className="mt-4 text-lg font-medium text-[var(--hud-accent)]"
        role="status"
      >
        Recepción de juegos cerrada
      </p>
    );
  }

  return (
    <div className="mt-8 max-w-xl border border-border bg-card p-5 sm:p-6">
      <p className="text-sm font-medium">
        Recibimos juegos hasta el{" "}
        <time dateTime={deadline}>miércoles 14 de octubre, 8:00 p. m.</time>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Hora de Lima · UTC−5</p>
      {countdown}
      <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
        Anuncio del ganador:{" "}
        <time dateTime="2026-10-15">jueves 15 de octubre</time>.
      </p>
    </div>
  );
}
