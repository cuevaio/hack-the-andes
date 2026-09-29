import {
  BrandContainer,
  BrandKicker,
  BrandSectionHeader,
  brandSectionClassName,
} from "@chofex/ui/components/brand";
import Image from "next/image";

import {
  devtoolCreditsCopy,
  devtoolPartners,
} from "@/components/landing/content";

export function LandingDevtoolCredits() {
  return (
    <section
      aria-labelledby="devtool-credits-heading"
      className="bg-[#08070a] text-[var(--hud-type)]"
      id="devtool-credits"
    >
      <BrandContainer className={brandSectionClassName}>
        <BrandSectionHeader
          className="max-w-4xl"
          title={devtoolCreditsCopy.title}
          titleId="devtool-credits-heading"
        >
          <p className="max-w-2xl text-lg leading-relaxed text-[var(--hud-type)]/70">
            {devtoolCreditsCopy.lede}
          </p>
        </BrandSectionHeader>

        <div className="grid gap-4 lg:grid-cols-2">
          {devtoolPartners.map((partner) => (
            <article
              className="flex flex-col border border-[var(--hud-type)]/20 bg-[#08070a]/75"
              key={partner.id}
            >
              <a
                aria-label={`Visitar ${partner.name}`}
                className="flex min-h-32 items-center border-[var(--hud-type)]/15 border-b p-6 transition-colors hover:bg-[var(--hud-type)]/5 sm:p-8"
                href={partner.href}
                rel="noreferrer"
                target="_blank"
              >
                <Image
                  alt={partner.name}
                  className="h-auto max-h-12 w-auto max-w-[min(100%,22rem)] object-contain object-left"
                  height={partner.logoHeight}
                  src={partner.logoSrc}
                  width={partner.logoWidth}
                />
              </a>

              <div className="grid flex-1 md:grid-cols-2">
                <div className="border-[var(--hud-type)]/15 border-b p-6 md:border-r md:border-b-0 sm:p-8">
                  <BrandKicker className="text-[var(--hud-action)]">
                    {devtoolCreditsCopy.participantsTitle}
                  </BrandKicker>
                  <p className="mt-5 font-display text-3xl uppercase leading-none">
                    {partner.participantBenefit.duration}
                  </p>
                  <p className="mt-2 text-lg text-[var(--hud-type)]">
                    {partner.participantBenefit.plan}
                  </p>
                  <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--hud-type)]/60">
                    {partner.participantBenefit.value}
                  </p>
                  <p className="mt-5 text-xs leading-relaxed text-[var(--hud-type)]/50">
                    {devtoolCreditsCopy.participantsNote}
                  </p>
                </div>

                <div className="p-6 sm:p-8">
                  <BrandKicker className="text-[var(--hud-accent)]">
                    {devtoolCreditsCopy.winnersTitle}
                  </BrandKicker>
                  <dl className="mt-5 space-y-5">
                    {partner.winnerPrizes.map((prize) => (
                      <div key={prize.place}>
                        <dt className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--hud-type)]/55">
                          {prize.place}
                        </dt>
                        <dd className="mt-1 text-base leading-snug">
                          {prize.prize}
                        </dd>
                        <dd className="mt-1 text-sm text-[var(--hud-type)]/60">
                          Valorado en {prize.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </article>
          ))}
        </div>
      </BrandContainer>
    </section>
  );
}
