"use client";

import { cn } from "@chofex/ui/lib/utils";
import { ArrowDownToLine, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InfiniteGrid } from "@/components/gallery/infinite-grid";
import {
  type GalleryPhoto,
  galleryClipSrc,
  galleryFullSrc,
  galleryPhotos,
  galleryThumbSrc,
} from "@/components/gallery/photos";

type DayFilter = "all" | 1 | 2;

const dayFilters: readonly { value: DayFilter; label: string }[] = [
  { value: "all", label: "Todo" },
  { value: 1, label: "Día 1" },
  { value: 2, label: "Día 2" },
];

function itemLabel(item: GalleryPhoto, index: number, total: number) {
  const kind = item.video ? "video" : "foto";
  return `Abrir ${kind} ${index + 1} de ${total}`;
}

export function PhotoGallery() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [day, setDay] = useState<DayFilter>("all");
  const [current, setCurrent] = useState<number | null>(null);

  const items = useMemo(
    () =>
      day === "all"
        ? galleryPhotos
        : galleryPhotos.filter((item) => item.day === day),
    [day],
  );
  const grid = useMemo(
    () => ({
      sources: items.map(galleryThumbSrc),
      clips: items.map((item) => (item.video ? galleryClipSrc(item) : null)),
      labels: items.map((item, index) => itemLabel(item, index, items.length)),
    }),
    [items],
  );

  const open = useCallback((index: number) => {
    setCurrent(index);
    dialogRef.current?.showModal();
  }, []);

  const move = useCallback(
    (delta: number) => {
      setCurrent((index) => {
        if (index === null) return index;
        return (index + delta + items.length) % items.length;
      });
    },
    [items.length],
  );

  useEffect(() => {
    if (current === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, move]);

  const item = current === null ? null : items[current];
  const kind = item?.video ? "Video" : "Foto";

  return (
    <>
      <InfiniteGrid
        clips={grid.clips}
        labels={grid.labels}
        onOpen={open}
        sources={grid.sources}
      />
      <fieldset className="absolute inset-x-0 top-16 z-20 flex justify-center sm:top-3">
        <legend className="sr-only">Filtrar por día</legend>
        <div className="flex border border-foreground/15 bg-background/80 p-1 backdrop-blur-md">
          {dayFilters.map((filter) => (
            <button
              aria-pressed={day === filter.value}
              className={cn(
                "h-9 px-4 text-sm whitespace-nowrap transition-colors",
                day === filter.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
              key={filter.value}
              onClick={() => setDay(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </fieldset>
      <dialog
        aria-label="Foto de Hack the Andes"
        className="m-0 h-dvh max-h-none w-dvw max-w-none border-0 bg-black/92 p-0 text-white backdrop:bg-black/60"
        onClose={() => setCurrent(null)}
        ref={dialogRef}
      >
        {item && current !== null ? (
          <div className="flex size-full flex-col">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <p className="font-mono text-xs tracking-widest text-white/70 uppercase">
                {current + 1} / {items.length}
              </p>
              <div className="flex items-center gap-2">
                <a
                  className="inline-flex h-10 items-center gap-2 px-3 text-sm whitespace-nowrap hover:bg-white/10"
                  download={`hack-the-andes-${item.slug}.${item.video ? "mp4" : "webp"}`}
                  href={
                    item.video ? galleryClipSrc(item) : galleryFullSrc(item)
                  }
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
              {item.video ? (
                <video
                  aria-label={`${kind} ${current + 1} de ${items.length} de Hack the Andes`}
                  autoPlay
                  className="max-h-full max-w-full object-contain"
                  controls
                  height={item.height}
                  key={item.slug}
                  loop
                  muted
                  playsInline
                  poster={galleryFullSrc(item)}
                  src={galleryClipSrc(item)}
                  width={item.width}
                />
              ) : (
                // biome-ignore lint/performance/noImgElement: pre-sized static WebP served as is
                <img
                  alt={`${kind} ${current + 1} de ${items.length} de Hack the Andes`}
                  className="max-h-full max-w-full object-contain"
                  height={item.height}
                  key={item.slug}
                  src={galleryFullSrc(item)}
                  width={item.width}
                />
              )}
              <button
                aria-label="Anterior"
                className="absolute top-1/2 left-2 inline-flex size-12 -translate-y-1/2 items-center justify-center bg-black/40 hover:bg-white/15 sm:left-4"
                onClick={() => move(-1)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" className="size-6" />
              </button>
              <button
                aria-label="Siguiente"
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
