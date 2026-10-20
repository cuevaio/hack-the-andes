"use client";

import { useState } from "react";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copiado");
    } catch {
      setMessage("Selecciona y copia el texto");
    }
  }
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="text-xs text-white/50">{label}</dt>
        <dd className="mt-1 break-words text-sm text-white/90">{value}</dd>
      </div>
      <button
        aria-label={`Copiar ${label.toLowerCase()}`}
        className="shrink-0 text-xs text-white/60 hover:text-white"
        onClick={copy}
        type="button"
      >
        {message === "Copiado" ? "Copiado" : "Copiar"}
      </button>
      <span aria-live="polite" className="sr-only">
        {message}
      </span>
    </div>
  );
}
