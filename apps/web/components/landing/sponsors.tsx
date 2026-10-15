import {
  BrandContainer,
  BrandKicker,
  brandSectionClassName,
} from "@chofex/ui/components/brand";
import Image from "next/image";
import { partners, sponsors, sponsorsCopy } from "@/components/landing/content";

export function LandingSponsors() {
  return (
    <section
      aria-labelledby="sponsors-heading"
      className="bg-[var(--hud-card)] text-[var(--hud-ink)]"
      id="sponsors"
    >
      <BrandContainer className={brandSectionClassName}>
        <h2 className="sr-only" id="sponsors-heading">
          {sponsorsCopy.kicker}
        </h2>
        <p className="mb-10 max-w-md text-base leading-relaxed text-[var(--hud-muted)]">
          {sponsorsCopy.lede}
        </p>
        {/*
         * Named here, unlike in the hero. This is the section a reader comes to
         * for exactly this, so the role each partner plays is visible copy
         * rather than alt text, and every mark is a link to whoever it belongs
         * to.
         */}
        <ul className="grid gap-px border-[var(--hud-ink)]/15 border-y bg-[var(--hud-ink)]/10 sm:grid-cols-3">
          {partners.map((partner) => (
            <li className="bg-[var(--hud-paper)]" key={partner.id}>
              <a
                className="grid h-full grid-rows-[auto_4rem] gap-8 p-6 transition-opacity hover:opacity-80 sm:p-8"
                href={partner.href}
                rel="noreferrer"
                target="_blank"
              >
                <BrandKicker className="text-[var(--hud-ink)]/60">
                  {partner.role}
                </BrandKicker>
                <Image
                  alt={partner.name}
                  className={`w-auto self-center justify-self-start ${
                    partner.shape === "stacked" ? "h-16" : "h-9 sm:h-10"
                  }`}
                  height={partner.logoHeight}
                  src={partner.logoSrc}
                  width={partner.logoWidth}
                />
              </a>
            </li>
          ))}
        </ul>
        <h3 className="mt-16 mb-8 font-mono text-sm uppercase tracking-[0.16em] text-[var(--hud-muted)]">
          {sponsorsCopy.sponsorsHeading}
        </h3>
        <ul className="grid grid-cols-2 gap-px border-[var(--hud-ink)]/15 border-y bg-[var(--hud-ink)]/10 sm:grid-cols-3 lg:grid-cols-4">
          {sponsors.map((sponsor) => (
            <li
              className="grid content-center gap-5 bg-[var(--hud-paper)] px-5 py-8 sm:px-8"
              key={sponsor.id}
            >
              <div className="relative mx-auto h-16 w-full max-w-48">
                <Image
                  alt=""
                  className="object-contain"
                  fill
                  sizes="(max-width: 639px) 40vw, 192px"
                  src={sponsor.logoSrc}
                />
              </div>
              <p className="text-center text-sm text-[var(--hud-muted)]">
                {sponsor.name}
              </p>
            </li>
          ))}
        </ul>
      </BrandContainer>
    </section>
  );
}
