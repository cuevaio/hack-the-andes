"use client";

import { BrandKicker } from "@chofex/ui/components/brand";
import { buttonVariants } from "@chofex/ui/components/button";
import Image from "next/image";
import Link from "next/link";

import {
  discordCopy,
  facts,
  heroCopy,
  partners,
} from "@/components/landing/content";
import { Terrain } from "@/components/landing/terrain";

/**
 * The drawn hero.
 *
 * Composed as a poster rather than as a page: the range across the top, the
 * lockup centred beneath it, and the liquid gathered along the line where the
 * two meet. Nothing to explore and nowhere to fly — the camera is parked, and
 * the one thing the hero asks for is a sideways drag, which turns the range on
 * the spot.
 */
export function LandingHero() {
  return (
    <>
      {/*
       * `svh`, never `dvh`.
       *
       * `dvh` is the *dynamic* viewport: on a phone it grows the moment the
       * browser's URL bar retracts and shrinks when it returns. Sizing a
       * section in it makes the whole document taller mid-scroll, and
       * everything below moves down with it — which from inside the page reads
       * as the content jumping backwards while you scroll forwards. Caught in a
       * 60fps recording: the jump lands on the exact frame Chrome's bar
       * collapses.
       *
       * `svh` is the small viewport — the height with the chrome shown — and it
       * does not change when the chrome goes. The cost is that once the bar
       * hides, the section is a bar's height short of the screen; that is the
       * trade this unit exists to make.
       */}
      <section className="landing-hero relative h-svh w-full" id="world">
        <div className="relative flex h-full flex-col overflow-hidden">
          {/*
           * The drawing dissolves into the ground rather than ending at the edge
           * of its box. The reference does the same thing with a pen — the
           * foreground ridges thin out to a few strokes and then to nothing — and
           * a hard cut here reads as a cropped image sitting on the page.
           */}
          {/*
           * Full bleed, and no mask.
           *
           * The drawing spent several iterations boxed into the top 56% and faded
           * out below it, which deleted the one thing the reference leads with: a
           * foreground that sweeps out of the bottom edge of the frame. The black
           * under the type is not a wash — it is the valley floor, drawn with the
           * few widely spaced lines a smooth surface earns.
           */}
          <Terrain className="absolute inset-0" />

          {/*
           * Light washes, and they have to stay light.
           *
           * An opaque veil over the bottom two fifths is the obvious way to seat
           * centred type, and it spent several iterations convincing me the
           * renderer was clipping the foreground: the near ridges were being
           * drawn correctly and painted over by this. The foreground sweeping out
           * of the bottom edge is the thing the reference leads with.
           */}
          <div
            aria-hidden="true"
            className="landing-hero-floor-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[34%]"
          />
          <div
            aria-hidden="true"
            className="landing-hero-sky-fade pointer-events-none absolute inset-x-0 top-0 z-10 h-44"
          />
          {/*
           * And one soft ellipse under the lockup.
           *
           * Measured, not decorative: the densest contour lines in the drawing
           * are near-white, and where they pass behind the letterforms the
           * headline falls to 1.3:1 — white type on white line art. A band across
           * the frame would fix it by deleting the mountain; an ellipse sits the
           * letters on ground and leaves the range visible around them.
           */}
          <div
            aria-hidden="true"
            className="landing-hero-lockup-wash pointer-events-none absolute inset-0 z-10"
          />

          {/*
           * Pointer events off, so the drag underneath is available across the
           * whole frame; the CTA and the links switch them back on for
           * themselves.
           */}
          <div className="pointer-events-none relative z-20 mx-auto flex h-full w-full max-w-7xl items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
            {/* The lockup owns the first viewport; event facts begin after it. */}
            <div className="flex flex-col items-center gap-6 text-center">
              {/*
               * One line, centred, uppercase — the lockup as it appears on the
               * poster. The two-line ranged-left version belongs to a hero with a
               * column of copy beside it; this one has a mountain above it.
               */}
              <h1
                className={
                  "font-brand font-semibold leading-[0.88] tracking-[0.012em] max-w-[16ch] text-[clamp(2.6rem,8vw,6.8rem)] uppercase"
                }
              >
                {/*
                 * One colour, the way the poster has it. The burnt red measured
                 * 1.1:1 where the brightest contour lines run behind ANDES — and
                 * it was competing with the red the liquid is already glowing
                 * behind the lockup, so the word was reading as a smudge in the
                 * middle of the colour rather than as the accent. The colour in
                 * this hero belongs to the field; the type is white on it.
                 */}
                <span
                  className="landing-glitch text-[var(--hud-type)]"
                  data-text={`${heroCopy.titleLead} ${heroCopy.titleAccent}`}
                >
                  {heroCopy.titleLead} {heroCopy.titleAccent}
                </span>
              </h1>

              <p className="flex flex-col font-mono text-sm text-[var(--hud-type)] uppercase tracking-[0.2em] sm:text-base">
                <span>{heroCopy.metaDate}</span>
                <span>{heroCopy.metaLocation}</span>
              </p>

              <div className="mt-1 flex w-full max-w-xl flex-col items-center gap-3">
                <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
                  <a
                    className={buttonVariants({
                      size: "landing",
                      className: "pointer-events-auto w-full sm:w-auto",
                    })}
                    href="#apply"
                  >
                    <span>{heroCopy.cta}</span>
                  </a>
                  <Link
                    className={buttonVariants({
                      variant: "outline",
                      size: "landing",
                      className:
                        "pointer-events-auto w-full whitespace-nowrap sm:w-auto",
                    })}
                    href="/challenges/make-it-fast"
                  >
                    <span>{heroCopy.challengeCta}</span>
                  </Link>
                </div>
                <p className="max-w-lg text-balance text-xs leading-relaxed text-[var(--hud-type)]/80 sm:text-sm">
                  {heroCopy.admission}
                </p>
                <Link
                  className="pointer-events-auto font-mono text-xs text-[var(--hud-type)]/80 uppercase tracking-[0.12em] underline underline-offset-4 hover:text-[var(--hud-type)]"
                  href="/discord"
                >
                  {discordCopy.cta}
                </Link>
              </div>

              {/*
               * The partners as marks, not as a line of type.
               *
               * Chofex takes the middle and the most width because it is the
               * principal sponsor; the other two flank it. Sized by height
               * rather than width — Peru Tech Week's mark is square and the
               * other two are four times wider than they are tall, so matching
               * widths would make it tower over both.
               *
               * The role each one plays used to be the visible copy here and is
               * now in the alt text, which is where it still reaches anyone who
               * cannot see the marks.
               */}
              <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:gap-x-12">
                {partners.map((partner) => (
                  <li key={partner.id}>
                    <Image
                      alt={`${partner.name}, ${partner.role}`}
                      className={[
                        "w-auto",
                        partner.shape === "stacked"
                          ? "h-11 sm:h-12"
                          : "h-6 sm:h-7",
                        // The principal sponsor at full strength; the other two
                        // a step back, so the middle of the row reads first.
                        partner.id === "chofex" ? "sm:h-8" : "opacity-80",
                      ].join(" ")}
                      height={partner.logoHeight}
                      priority
                      src={partner.logoSrc}
                      width={partner.logoWidth}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-8 sm:px-8 lg:px-10">
        {/*
         * The facts strip gets a surface of its own.
         *
         * It is the one block of small type that sits on the foreground
         * ridges, where the lines run brightest, and measured there the
         * labels came back at 1.3:1. Everything else in the hero is display
         * size or sits inside the lockup's scrim.
         */}
        <ul className="landing-hero-facts grid grid-cols-2 border-[var(--hud-type)]/20 border-y lg:grid-cols-4">
          {facts.map((fact) => (
            <li
              className="border-[var(--hud-type)]/15 border-r px-3 py-3 text-[var(--hud-type)] last:border-r-0"
              key={fact.label}
            >
              <BrandKicker className="mb-1 text-[var(--hud-type)]/75">
                {fact.label}
              </BrandKicker>
              <p className="font-display text-xl leading-none">{fact.value}</p>
            </li>
          ))}
        </ul>

        <a
          className="pointer-events-auto self-center text-[var(--hud-type)]"
          href="#why"
        >
          <span className="sr-only">{heroCopy.skipToWhy}</span>
          <span aria-hidden="true" className="block text-3xl leading-none">
            ⌄
          </span>
        </a>
      </div>
    </>
  );
}
