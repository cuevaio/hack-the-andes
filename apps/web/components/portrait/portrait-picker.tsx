"use client";

/**
 * Choosing the face on a credential.
 *
 * Two sources, both of which the registration already models: the GitHub
 * profile somebody put on their form, and a photograph they upload. Every
 * one goes through the same segmenter, so a credential cannot carry one
 * face on a cut-out background and another on a kitchen.
 *
 * Nothing is stored until the cut-out has been shown and accepted.
 * Segmentation fails honestly on a busy background, and somebody has to
 * be able to see that and say no — a picker that uploaded first would put
 * a half-erased room on a badge.
 *
 * It writes through the registration's own endpoint rather than the
 * columns. `pictureSource` is also a field of the acceptance details, and
 * two paths writing it is how one silently reverts the other.
 */

import { useId, useRef, useState } from "react";

import { CutoutError, cutout } from "@/lib/portrait/cutout";

interface PortraitPickerProps {
  /** Their form's GitHub profile, when it carried one. */
  readonly githubAvatarUrl: string | null;
  /** Whether the picture on the card is already theirs by choice. */
  readonly confirmed: boolean;
  /** Reloads the credential once a new picture is stored. */
  readonly onStored: () => void;
}

type Stage = "closed" | "choosing" | "working" | "preview" | "failed";

/** What a failed cut-out says, in the one place it can be acted on. */
const FAILURE =
  "No pudimos separar el fondo. Prueba con una foto de fondo liso.";

export function PortraitPicker({
  githubAvatarUrl,
  confirmed,
  onStored,
}: PortraitPickerProps) {
  const [stage, setStage] = useState<Stage>("closed");
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileId = useId();
  const pending = useRef<Blob | null>(null);

  /** Frees the last preview before replacing it: object URLs are not GC'd. */
  const showPreview = (blob: Blob) => {
    setPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return URL.createObjectURL(blob);
    });
  };

  const run = async (image: HTMLImageElement) => {
    setStage("working");
    setMessage(null);
    try {
      const blob = await cutout(image);
      pending.current = blob;
      showPreview(blob);
      setStage("preview");
    } catch (error) {
      pending.current = null;
      setMessage(error instanceof CutoutError ? FAILURE : FAILURE);
      setStage("failed");
    }
  };

  const fromUrl = (url: string) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      void run(image);
    };
    image.onerror = () => {
      setMessage("No pudimos leer esa foto.");
      setStage("failed");
    };
    image.src = url;
  };

  const fromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        void run(image);
      };
      image.onerror = () => {
        setMessage("Ese archivo no es una imagen que podamos leer.");
        setStage("failed");
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Three phases, because that is what the endpoint is.
   *
   * It does not take a file: a POST asks for a grant, the browser uploads
   * straight to storage with the token it comes back with, and a PUT
   * reports the result so the server can inspect and record it. Sending a
   * `FormData` here — which is what this did before the contract was
   * read — gets a schema error and nothing stored.
   */
  const store = async () => {
    const blob = pending.current;
    if (!blob) {
      return;
    }
    setStage("working");

    const fail = () => {
      setMessage("No pudimos guardar la foto. Inténtalo otra vez.");
      setStage("failed");
    };

    try {
      const granted = await fetch("/api/v1/profile-picture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: "image/png", size: blob.size }),
      });
      if (!granted.ok) {
        fail();
        return;
      }
      const { data } = (await granted.json()) as {
        data: { pathname: string; clientToken: string };
      };

      // `put`, not `upload`: the latter fetches its own token by a
      // protocol this endpoint does not speak, while the grant above
      // already carries one.
      const { put } = await import("@vercel/blob/client");
      const stored = await put(data.pathname, blob, {
        access: "public",
        token: data.clientToken,
        contentType: "image/png",
      });

      const recorded = await fetch("/api/v1/profile-picture", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pathname: data.pathname, url: stored.url }),
      });
      if (!recorded.ok) {
        fail();
        return;
      }

      /*
        The step without which none of the above shows on the badge.

        Storing an upload writes the badge profile; the card reads
        `pictureUrl`, and only a confirmation turns one into the other.
        The first version stopped at the line above, told somebody their
        photograph was saved, reloaded, and changed nothing.

        Always `upload`: a GitHub photo reaches here having been through
        the segmenter too, so what is stored is a new picture regardless
        of where it came from.
      */
      const confirmedSource = await fetch("/api/v1/profile-picture", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pictureSource: "upload" }),
      });
      if (!confirmedSource.ok) {
        const reason = await confirmedSource.json().catch(() => null);
        if (reason?.error?.code === "ATTENDANCE_NOT_CONFIRMED") {
          setMessage(
            "Confirma tu asistencia con `andes confirm` antes de cambiar la foto.",
          );
          setStage("failed");
          return;
        }
        fail();
        return;
      }

      setStage("closed");
      onStored();
    } catch {
      fail();
    }
  };

  if (stage === "closed") {
    return (
      <button
        className="portrait-open"
        onClick={() => setStage("choosing")}
        type="button"
      >
        Cambiar foto
      </button>
    );
  }

  let body = null;
  if (stage === "choosing" || stage === "failed") {
    body = (
      <div className="portrait-sources">
        {githubAvatarUrl ? (
          <button
            className="portrait-source"
            onClick={() => fromUrl(githubAvatarUrl)}
            type="button"
          >
            Usar mi foto de GitHub
          </button>
        ) : null}
        <label className="portrait-source" htmlFor={fileId}>
          Subir una foto
          <input
            accept="image/*"
            id={fileId}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                fromFile(file);
              }
            }}
            type="file"
          />
        </label>
      </div>
    );
  }

  if (stage === "working") {
    body = <p className="portrait-status">Recortando…</p>;
  }

  if (stage === "preview" && preview) {
    body = (
      <div className="portrait-preview">
        <p className="portrait-status">Así quedará en tu carnet</p>
        {/* biome-ignore lint/performance/noImgElement: an object URL, not a remote asset */}
        <img alt="Vista previa de tu foto recortada" src={preview} />
        <div className="portrait-actions">
          <button
            className="portrait-confirm"
            onClick={() => void store()}
            type="button"
          >
            Confirmar
          </button>
          <button
            className="portrait-source"
            onClick={() => setStage("choosing")}
            type="button"
          >
            Elegir otra
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="portrait-picker">
      <p className="portrait-title">
        {confirmed ? "Cambiar tu foto" : "Elige la foto de tu carnet"}
      </p>
      {body}
      {message ? (
        <p className="portrait-error" role="alert">
          {message}
        </p>
      ) : null}
      <button
        className="portrait-close"
        onClick={() => setStage("closed")}
        type="button"
      >
        Cerrar
      </button>
    </section>
  );
}
