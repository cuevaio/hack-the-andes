"use client";

import { createContext, type ReactNode, useContext } from "react";

// A standalone `Photos` still renders normally; only the pager opts later
// slides out through an explicit provider.
const DeckMediaLoadContext = createContext(true);
// Media that plays (a video) also needs to know whether its slide is the one on
// screen: every slide stays mounted, so without this it would keep playing,
// sound included, after the presenter moves on.
const DeckSlideActiveContext = createContext(true);

export function useDeckMediaLoad() {
  return useContext(DeckMediaLoadContext);
}

export function useDeckSlideActive() {
  return useContext(DeckSlideActiveContext);
}

function DeckPhoto({
  src,
  alt,
  interactiveOnly = false,
}: {
  src: string;
  alt: string;
  interactiveOnly?: boolean;
}) {
  // These stay plain images because each source already ships as a compressed
  // AVIF at its maximum rendered size.
  return (
    // biome-ignore lint/performance/noImgElement: pre-sized static AVIF
    <img
      alt={alt}
      className="deck-photo"
      data-interactive-only={interactiveOnly || undefined}
      decoding="async"
      fetchPriority="low"
      src={src}
    />
  );
}

export function DeckMediaLoadProvider({
  children,
  shouldLoad,
  active,
}: {
  children: ReactNode;
  shouldLoad: boolean;
  active: boolean;
}) {
  return (
    <DeckMediaLoadContext value={shouldLoad}>
      <DeckSlideActiveContext value={active}>{children}</DeckSlideActiveContext>
    </DeckMediaLoadContext>
  );
}

/**
 * Photographs of the team's previous hackathons, as an object on the slide.
 *
 * The pager keeps every slide mounted, so native lazy loading alone sees every
 * photograph at the viewport coordinates and fetches all of them. The provider
 * above only gives the current and next slide a `src`; sequential navigation
 * remains preloaded without making evidence near the end block the cover.
 */
export function Photos({
  items,
  caption,
}: {
  items: Array<{ src: string; alt: string }>;
  caption?: string;
}) {
  const shouldLoad = useContext(DeckMediaLoadContext);

  return (
    <figure className="deck-photos" data-count={items.length}>
      <div className="deck-photo-row">
        {shouldLoad
          ? items.map((item) => (
              <DeckPhoto
                alt={item.alt}
                interactiveOnly
                key={item.src}
                src={item.src}
              />
            ))
          : null}
        <noscript>
          {items.map((item) => (
            <DeckPhoto alt={item.alt} key={item.src} src={item.src} />
          ))}
        </noscript>
      </div>
      {caption ? (
        <figcaption className="deck-photo-caption">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
