"use client";

import { useEffect, useRef } from "react";

import { useDeckMediaLoad, useDeckSlideActive } from "./photos";

/**
 * A video shown on the slide, played in the room.
 *
 * Every slide stays mounted, so the element follows its slide instead of the
 * viewport: it gets a `src` only near the current slide (same rule as
 * `Photos`), starts when its slide becomes active and pauses when the
 * presenter leaves. The keypress that navigated here is the user gesture that
 * lets it start with sound; if the browser still refuses, native controls stay
 * on screen so one click starts it.
 */
export function Video({
  src,
  captions,
  poster,
  caption,
}: {
  src: string;
  /** WebVTT file, in Spanish. Off until the presenter turns it on. */
  captions: string;
  poster?: string;
  caption?: string;
}) {
  const shouldLoad = useDeckMediaLoad();
  const active = useDeckSlideActive();
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (active) {
      video.play().catch(() => {
        // Autoplay refused: the controls are the fallback.
      });
    } else {
      video.pause();
    }
  }, [active]);

  return (
    <figure className="deck-video">
      <video
        className="deck-video-media"
        controls
        playsInline
        poster={poster}
        preload="auto"
        ref={ref}
        src={shouldLoad ? src : undefined}
      >
        <track kind="captions" label="Español" src={captions} srcLang="es" />
      </video>
      {caption ? (
        <figcaption className="deck-photo-caption">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
