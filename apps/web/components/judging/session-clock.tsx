"use client";

import { useEffect, useState } from "react";
import type { JudgingSession } from "@/lib/judging/contract";

export function useFreshConnection(updatedAt: number, error: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);
  return !error && now - updatedAt < 6500;
}
export function SessionClock({ session }: { session: JudgingSession }) {
  const [received, setReceived] = useState({
    serverNow: session.serverNow,
    at: Date.now(),
  });
  const [now, setNow] = useState(() => Date.now());
  if (received.serverNow !== session.serverNow)
    setReceived({ serverNow: session.serverNow, at: Date.now() });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  let remaining = session.remainingMs;
  if (session.running)
    remaining = Math.max(0, remaining - Math.max(0, now - received.at));
  let phase = "Pitch";
  let phaseMs = Math.max(0, remaining - 120000);
  if (remaining <= 120000) {
    phase = "Preguntas";
    phaseMs = remaining;
  }
  if (remaining <= 0) phase = "Tiempo cumplido";
  if (!session.currentPresentationId)
    return (
      <p className="text-muted-foreground">
        Esperando a que la organización inicie una presentación.
      </p>
    );
  const seconds = Math.ceil(phaseMs / 1000);
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-5">
      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {phase}
        </p>
        <p className="text-sm text-muted-foreground">
          {session.running ? "En curso" : "En pausa"} · 3 min de pitch + 2 min
          de preguntas
        </p>
      </div>
      <p
        role="timer"
        className="font-mono text-4xl tabular-nums"
        aria-label={`${phase}: ${Math.floor(seconds / 60)} minutos y ${seconds % 60} segundos`}
      >
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      </p>
    </div>
  );
}
