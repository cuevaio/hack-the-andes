import { BrandPage } from "@chofex/ui/components/brand";

import { LandingApply } from "@/components/landing/apply";
import { LandingEvent } from "@/components/landing/event";
import { LandingFaq } from "@/components/landing/faq";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHero } from "@/components/landing/hero";
import { HERO_POSTER_PRELOAD } from "@/components/landing/hero-poster";
import { LandingParticipantPerks } from "@/components/landing/participant-perks";
import { LandingPeople } from "@/components/landing/people";
import { LandingPrizes } from "@/components/landing/prizes";
import { LandingQualifierChallenges } from "@/components/landing/qualifier-challenges";
import { LandingSkipLinks } from "@/components/landing/skip-links";
import { LandingSponsors } from "@/components/landing/sponsors";
import { LandingTracks } from "@/components/landing/tracks";

import "@/components/landing/dark.css";
import "@/components/landing/landing.css";

/**
 * The landing.
 *
 * Black, and opening on the Sacred Valley drawn in white contour lines from a
 * parked vantage inside the range — turned by dragging, not flown through.
 * Shared theme tokens live in `@chofex/ui/globals.css`; landing-only effects
 * live in `components/landing/dark.css` and `components/landing/landing.css`.
 *
 * Section order after the hero is locked:
 * Evento (#why) → Premios → Perks → Panel → Tracks → Challenges → Postular →
 * FAQs → Organizadores. Do not restore a separate experiencia chapter.
 */
export default function Home() {
  return (
    <BrandPage className="landing-dark" id="top">
      {/* The poster is the opening paint. The Draco terrain is warmed only
          after capability gating, off this document's critical path. */}
      <link
        rel="preload"
        href={HERO_POSTER_PRELOAD.href}
        as={HERO_POSTER_PRELOAD.as}
        type={HERO_POSTER_PRELOAD.type}
      />
      <LandingSkipLinks />
      <main id="contenido">
        <LandingHero />
        <LandingEvent />
        <LandingPrizes />
        <LandingParticipantPerks />
        <LandingPeople />
        <LandingTracks />
        <LandingQualifierChallenges />
        <LandingApply />
        <LandingFaq />
        <LandingSponsors />
      </main>
      <LandingFooter />
    </BrandPage>
  );
}
