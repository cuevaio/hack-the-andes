import {
  BrandContainer,
  BrandKicker,
  BrandSectionHeader,
  brandSectionClassName,
} from "@chofex/ui/components/brand";
import { trackSeats, tracksCopy } from "@/components/landing/content";
import { ContourSeal } from "@/components/landing/illustrations";

/**
 * Formation parameters for each sealed track card.
 * Each index gets a distinct topographic signature — different ridge shape —
 * so the four cards read as genuinely separate sealed formations.
 *
 *   01 — broad E-W ridge (elongated, low): wide challenge space
 *   02 — steep symmetric peak (nearly circular): concentrated, intense
 *   03 — tilted elongated formation: irregular, asymmetric problem
 */
const TRACK_FORMATIONS = [
  { rxOuter: 98, ryOuter: 66, rotateDeg: 0 },
  { rxOuter: 80, ryOuter: 78, rotateDeg: 0 },
  { rxOuter: 94, ryOuter: 58, rotateDeg: -8 },
  { rxOuter: 88, ryOuter: 72, rotateDeg: 12 },
] as const;

export function LandingTracks() {
  return (
    <section
      aria-labelledby="tracks-heading"
      className="bg-[var(--hud-card)]"
      id="tracks"
    >
      <BrandContainer className={brandSectionClassName}>
        <BrandSectionHeader
          title={tracksCopy.title}
          subtitle={tracksCopy.subtitle}
          titleId="tracks-heading"
        >
          <p className="max-w-xl text-lg leading-relaxed text-[var(--hud-ink)]/75">
            {tracksCopy.lede}
          </p>
        </BrandSectionHeader>

        <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {trackSeats.map((track, index) => {
            const formation = TRACK_FORMATIONS[index] ?? {
              rxOuter: 96,
              ryOuter: 74,
              rotateDeg: 0,
            };
            return (
              <li
                className="landing-dossier relative flex min-h-[24rem] overflow-hidden border border-[var(--hud-ink)]/15 bg-[var(--hud-paper)]"
                key={track.index}
              >
                {/*
                 * Contour seal — topographic formation unique to this brief.
                 * Positioned bottom-right, bleeding off the card edge (overflow-hidden
                 * clips it). Replaces the ghost number: same "depth" signal, richer
                 * visual language, reduced chrome.
                 */}
                <ContourSeal
                  className="absolute right-0 bottom-0 w-3/4 translate-x-1/4 translate-y-1/4 text-[var(--hud-ink)]"
                  rxOuter={formation.rxOuter}
                  ryOuter={formation.ryOuter}
                  rotateDeg={formation.rotateDeg}
                />

                <div className="relative z-10 flex w-full flex-col justify-between p-6 sm:p-8">
                  <BrandKicker className="text-[var(--hud-muted)]">
                    Track {track.index}
                  </BrandKicker>

                  <p className="max-w-[28ch] text-lg leading-snug text-[var(--hud-ink)]">
                    {track.hint}
                  </p>

                  <BrandKicker className="border-[var(--hud-ink)]/15 border-t pt-4 text-[var(--hud-muted)]">
                    {tracksCopy.reveal}
                  </BrandKicker>
                </div>
              </li>
            );
          })}
        </ol>
      </BrandContainer>
    </section>
  );
}
