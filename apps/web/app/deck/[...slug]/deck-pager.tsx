"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DeckMediaLoadProvider } from "@/components/decks/photos";
import { chromeCopy } from "@/lib/decks/chrome-copy";
import type {
  DeckBackdrop,
  DeckLang,
  DeckLayout,
  DeckStyle,
  DeckVeil,
} from "@/lib/decks/loader";

type Slide = {
  id: string;
  title: string;
  content: ReactNode;
  backdrop: DeckBackdrop;
  veil: DeckVeil;
  layout: DeckLayout;
};

const SWIPE_THRESHOLD = 56;
/** px/ms — a short flick advances too, without crossing the distance threshold. */
const SWIPE_VELOCITY = 0.35;
const WHEEL_THRESHOLD = 80;
/** Keeps one trackpad flick from skipping five slides. */
const WHEEL_COOLDOWN_MS = 450;

function clampSlideIndex(index: number, slideCount: number) {
  return Math.max(0, Math.min(slideCount - 1, index));
}

/**
 * A slide taller than the viewport is read by scrolling; only at its edge does
 * the wheel change slides. Without this a slide with a table is unreachable.
 */
function canScrollWithinSlide(target: EventTarget | null, deltaY: number) {
  if (!(target instanceof HTMLElement) || deltaY === 0) return false;

  const scrollable = target.closest<HTMLElement>(".deck-slide-inner");
  if (!scrollable) return false;

  const canScrollDown =
    scrollable.scrollTop + scrollable.clientHeight <
    scrollable.scrollHeight - 1;
  const canScrollUp = scrollable.scrollTop > 0;

  return deltaY > 0 ? canScrollDown : canScrollUp;
}

export function DeckPager({
  slug,
  title,
  slides,
  deckStyle,
  lang,
}: {
  slug: string;
  title: string;
  description?: string;
  slides: Slide[];
  deckStyle?: DeckStyle;
  lang: DeckLang;
}) {
  const copy = chromeCopy(lang);
  const [activeIndex, setActiveIndex] = useState(0);
  const [indexOpen, setIndexOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const wheelDelta = useRef(0);
  const lastWheelMoveAt = useRef(0);

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(clampSlideIndex(index, slides.length));
    },
    [slides.length],
  );

  const prev = useCallback(() => {
    setActiveIndex((current) => clampSlideIndex(current - 1, slides.length));
  }, [slides.length]);

  const next = useCallback(() => {
    setActiveIndex((current) => clampSlideIndex(current + 1, slides.length));
  }, [slides.length]);

  // Lets the CSS tell the first paint apart from the hydrated state, so the
  // opening slide doesn't fade in.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (indexOpen) {
        if (event.key === "Escape" || event.key === "g" || event.key === "G") {
          setIndexOpen(false);
          event.preventDefault();
        }
        return;
      }

      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          prev();
          event.preventDefault();
          break;
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
          next();
          event.preventDefault();
          break;
        case "Home":
          goTo(0);
          event.preventDefault();
          break;
        case "End":
          goTo(slides.length - 1);
          event.preventDefault();
          break;
        case "g":
        case "G":
          setIndexOpen(true);
          event.preventDefault();
          break;
        case "Escape":
          setIndexOpen(false);
          event.preventDefault();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, next, prev, slides.length, indexOpen]);

  function onTouchStart(event: React.TouchEvent) {
    const t = event.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStart.current;
    const end = event.changedTouches[0];
    if (!start || !end) return;
    const dx = start.x - end.clientX;
    const dy = start.y - end.clientY;
    const dt = Date.now() - start.t;
    const velocity = Math.abs(dx) / Math.max(dt, 1);

    // Horizontal dominance, so a vertical scroll on mobile isn't stolen.
    if (
      Math.abs(dx) > Math.abs(dy) &&
      (Math.abs(dx) > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY)
    ) {
      if (dx > 0) next();
      else prev();
    }
    touchStart.current = null;
  }

  function onWheel(event: React.WheelEvent) {
    if (indexOpen || canScrollWithinSlide(event.target, event.deltaY)) return;

    const dominantDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    if (dominantDelta === 0) return;

    wheelDelta.current += dominantDelta;

    const now = Date.now();
    if (
      Math.abs(wheelDelta.current) < WHEEL_THRESHOLD ||
      now - lastWheelMoveAt.current < WHEEL_COOLDOWN_MS
    ) {
      return;
    }

    if (wheelDelta.current > 0) next();
    else prev();

    wheelDelta.current = 0;
    lastWheelMoveAt.current = now;
  }

  return (
    // Swipe and wheel are shortcuts layered over the keyboard and the button
    // controls below, which stay the accessible path through the deck.
    <div
      className="brand-light deck-pager"
      data-deck-style={deckStyle}
      // The deck's own language, which is not the app's: a screen reader needs
      // to know which voice to read a slide in.
      lang={lang}
      data-index-open={indexOpen}
      data-mounted={mounted}
      onTouchEnd={onTouchEnd}
      onTouchStart={onTouchStart}
      onWheel={onWheel}
    >
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100]"
        href={`/deck/${slug}`}
      >
        {copy.skipToDeck}
      </a>

      <header className="deck-chrome">
        <div className="deck-topbar">
          <span className="deck-deck-title">{title}</span>
          <button
            aria-controls="deck-index"
            aria-expanded={indexOpen}
            className="deck-key"
            onClick={() => setIndexOpen((v) => !v)}
            type="button"
          >
            {copy.index}
          </button>
        </div>
      </header>

      <main aria-atomic="true" aria-live="polite" className="deck-stage">
        {/*
         * The mat. Every slide sits inside it, plate included, so the design
         * stays a bounded object on a black page instead of a wall that grows
         * with the monitor. Past 16:9 it stops widening — a plate is 2048px of
         * drawing, and covering an ultrawide with it scales past its own
         * resolution.
         */}
        <div className="deck-stage-frame">
          {slides.map((slide, index) => (
            <section
              aria-hidden={index !== activeIndex}
              className="deck-slide"
              data-active={index === activeIndex}
              data-layout={slide.layout}
              key={slide.id}
            >
              {/*
               * The backdrop is its own element rather than a background on
               * the section: it carries the plate, the scrim and the grain as
               * three stacked layers, and `aria-hidden` keeps all of it out of
               * the accessibility tree — it is atmosphere, never content.
               */}
              <div
                aria-hidden="true"
                className="deck-backdrop"
                data-backdrop={slide.backdrop}
                // A CSS background on every mounted slide makes the browser
                // fetch the entire deck up front. Keep the current plate and
                // the next one eligible: sequential navigation stays instant,
                // while later plates wait until the reader approaches them.
                data-load-backdrop={
                  index === activeIndex || index === activeIndex + 1
                }
                data-veil={slide.veil}
              />
              <div className="deck-slide-inner">
                <div className="deck-slide-content">
                  <DeckMediaLoadProvider
                    active={index === activeIndex}
                    shouldLoad={
                      index === activeIndex || index === activeIndex + 1
                    }
                  >
                    {slide.content}
                  </DeckMediaLoadProvider>
                </div>
              </div>
            </section>
          ))}
        </div>
      </main>

      <div className="deck-controls">
        <span className="deck-counter">
          {String(activeIndex + 1).padStart(2, "0")} /{" "}
          {String(slides.length).padStart(2, "0")}
        </span>
        <div className="deck-keycaps">
          <button
            aria-label={copy.previousSlide}
            className="deck-key"
            disabled={activeIndex === 0}
            onClick={prev}
            type="button"
          >
            ←
          </button>
          <button
            aria-label={copy.nextSlide}
            className="deck-key"
            disabled={activeIndex === slides.length - 1}
            onClick={next}
            type="button"
          >
            →
          </button>
        </div>
      </div>

      {indexOpen && (
        <div
          aria-label={copy.indexDialog}
          aria-modal="true"
          className="deck-index"
          id="deck-index"
          role="dialog"
        >
          <div aria-hidden="true" className="deck-index-backdrop" />
          <div className="deck-index-panel">
            <div className="deck-index-header">
              <span className="deck-index-label">{copy.index}</span>
              <button
                aria-label={copy.closeIndex}
                className="deck-key"
                onClick={() => setIndexOpen(false)}
                type="button"
              >
                Esc
              </button>
            </div>
            <ol className="deck-index-list">
              {slides.map((slide, index) => (
                <li key={slide.id}>
                  <button
                    aria-current={index === activeIndex ? "true" : undefined}
                    className="deck-index-button"
                    onClick={() => {
                      setActiveIndex(index);
                      setIndexOpen(false);
                    }}
                    type="button"
                  >
                    <span className="deck-index-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="deck-index-title">{slide.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
