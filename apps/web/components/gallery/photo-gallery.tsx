"use client";

import { ArrowDownToLine, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { InfiniteGrid } from "@/components/gallery/infinite-grid";
import {
  galleryFullSrc,
  galleryPhotos,
  galleryThumbSrc,
} from "@/components/gallery/photos";

const thumbSources = galleryPhotos.map(galleryThumbSrc);
const photoLabels = galleryPhotos.map(
  (_, index) => `Abrir foto ${index + 1} de ${galleryPhotos.length}`,
);

export function PhotoGallery() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState<number | null>(null);

  const open = useCallback((index: number) => {
    setCurrent(index);
    dialogRef.current?.showModal();
  }, []);

  const move = useCallback((delta: number) => {
    setCurrent((index) => {
      if (index === null) return index;
      return (index + delta + galleryPhotos.length) % galleryPhotos.length;
    });
  }, []);

  useEffect(() => {
    if (current === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, move]);

  const photo = current === null ? null : galleryPhotos[current];

  return (
    <>
      <InfiniteGrid labels={photoLabels} onOpen={open} sources={thumbSources} />
      <dialog
        aria-label="Foto de Hack the Andes"
        className="m-0 h-dvh max-h-none w-dvw max-w-none border-0 bg-black/92 p-0 text-white backdrop:bg-black/60"
        onClose={() => setCurrent(null)}
        ref={dialogRef}
      >
        {photo && current !== null ? (
          <div className="flex size-full flex-col">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <p className="font-mono text-xs tracking-widest text-white/70 uppercase">
                {current + 1} / {galleryPhotos.length}
              </p>
              <div className="flex items-center gap-2">
                <a
                  className="inline-flex h-10 items-center gap-2 px-3 text-sm whitespace-nowrap hover:bg-white/10"
                  download={`hack-the-andes-${photo.slug}.webp`}
                  href={galleryFullSrc(photo)}
                >
                  <ArrowDownToLine aria-hidden="true" className="size-4" />
                  Descargar
                </a>
                <button
                  aria-label="Cerrar"
                  className="inline-flex size-10 items-center justify-center hover:bg-white/10"
                  onClick={() => dialogRef.current?.close()}
                  type="button"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-20">
              {/* biome-ignore lint/performance/noImgElement: pre-sized static WebP served as is */}
              <img
                alt={`Foto ${current + 1} de ${galleryPhotos.length} de Hack the Andes`}
                className="max-h-full max-w-full object-contain"
                height={photo.height}
                key={photo.slug}
                src={galleryFullSrc(photo)}
                width={photo.width}
              />
              <button
                aria-label="Foto anterior"
                className="absolute top-1/2 left-2 inline-flex size-12 -translate-y-1/2 items-center justify-center bg-black/40 hover:bg-white/15 sm:left-4"
                onClick={() => move(-1)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" className="size-6" />
              </button>
              <button
                aria-label="Foto siguiente"
                className="absolute top-1/2 right-2 inline-flex size-12 -translate-y-1/2 items-center justify-center bg-black/40 hover:bg-white/15 sm:right-4"
                onClick={() => move(1)}
                type="button"
              >
                <ChevronRight aria-hidden="true" className="size-6" />
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
