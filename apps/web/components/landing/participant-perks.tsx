import {
  BrandContainer,
  BrandKicker,
  BrandSectionHeader,
  brandSectionClassName,
} from "@chofex/ui/components/brand";
import Image from "next/image";

import {
  participantDevtoolPartners,
  participantPerks,
  participantPerksCopy,
} from "@/components/landing/content";

export function LandingParticipantPerks() {
  return (
    <section
      aria-labelledby="participant-perks-heading"
      className="bg-[var(--hud-card)] text-[var(--hud-ink)]"
      id="participant-perks"
    >
      <BrandContainer className={brandSectionClassName}>
        <BrandSectionHeader
          className="max-w-4xl"
          title={participantPerksCopy.title}
          titleId="participant-perks-heading"
        >
          <p className="max-w-2xl text-lg leading-relaxed text-[var(--hud-ink)]/75">
            {participantPerksCopy.lede}
          </p>
        </BrandSectionHeader>

        <div className="mb-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <BrandKicker className="text-[var(--hud-status)]">
              {participantPerksCopy.creditsTitle}
            </BrandKicker>
            <p className="text-sm text-[var(--hud-muted)]">
              {participantPerksCopy.creditsNote}
            </p>
          </div>

          <div className="grid gap-px bg-[var(--hud-ink)]/15 md:grid-cols-3">
            {participantDevtoolPartners.map((partner) => (
              <a
                className="grid min-h-48 grid-rows-[3rem_auto] gap-7 bg-[var(--hud-paper)] p-6 transition-colors hover:bg-[var(--hud-card)] sm:p-8"
                href={partner.href}
                key={partner.id}
                rel="noreferrer"
                target="_blank"
              >
                <Image
                  alt={partner.name}
                  className="h-auto max-h-10 w-auto max-w-[min(100%,19rem)] object-contain object-left"
                  height={partner.logoHeight}
                  src={partner.logoSrc}
                  width={partner.logoWidth}
                />
                <div>
                  <p className="font-display text-4xl uppercase leading-none">
                    {partner.participantBenefit.duration}
                  </p>
                  <p className="mt-2 text-lg">
                    {partner.participantBenefit.plan}
                  </p>
                  <p className="mt-2 font-mono text-xs text-[var(--hud-muted)]">
                    {partner.participantBenefit.value}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <ul className="grid gap-px bg-[var(--hud-ink)]/15 sm:grid-cols-2">
          {participantPerks.map((perk, index) => (
            <li
              className="grid min-h-44 grid-cols-[2.5rem_1fr] gap-4 bg-[var(--hud-paper)] p-6 sm:gap-6 sm:p-8"
              key={perk.title}
            >
              <BrandKicker className="text-[var(--hud-status)]">
                0{index + 1}
              </BrandKicker>
              <div>
                <h3 className="font-display text-2xl uppercase leading-none">
                  {perk.title}
                </h3>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--hud-muted)]">
                  {perk.body}
                </p>
                {perk.href && perk.cta && (
                  <a
                    className="mt-5 inline-flex font-mono text-xs uppercase tracking-[0.12em] text-[var(--hud-action)] underline-offset-4 hover:underline"
                    href={perk.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {perk.cta}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </BrandContainer>
    </section>
  );
}
