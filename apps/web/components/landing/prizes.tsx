import { BrandContainer } from "@chofex/ui/components/brand";
import Image from "next/image";

import {
  devtoolCreditsCopy,
  devtoolPartners,
  formatSoles,
  prizeAmountsPen,
  prizePoolHeadlinePen,
  prizesCopy,
} from "@/components/landing/content";
import { PrizeCounter } from "@/components/landing/prize-counter";

export function LandingPrizes() {
  return (
    <section
      aria-labelledby="prizes-heading"
      className="flex flex-col bg-[var(--hud-field)] text-[var(--hud-type)]"
      id="prizes"
    >
      <BrandContainer className="flex flex-col py-10 sm:py-16">
        {/* Section title — small kicker, also the landmark label */}
        <h2
          className="landing-type-meta mb-5 text-[var(--hud-type)]/60 sm:mb-8 md:mb-10"
          id="prizes-heading"
        >
          {prizesCopy.title}
        </h2>
        <p className="mb-8 max-w-2xl text-lg leading-relaxed text-[var(--hud-type)]/70 md:mb-10">
          {prizesCopy.lede}
        </p>

        {/*
         * Two columns from lg up, stacked below. The trip lockup is three
         * authored lines so "Viaje a" is explicit and CHOFEX / HEADQUARTERS
         * stay a readable pair instead of wrapping as four huge words.
         */}
        <div className="grid grid-cols-1 items-center gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-8 xl:gap-10">
          <div className="prize-total min-w-0">
            <p className="whitespace-nowrap font-display text-[clamp(6rem,24vw,8.5rem)] leading-[0.76] tracking-[-0.05em] lg:text-[clamp(3.25rem,9vw,7.25rem)]">
              <PrizeCounter amount={prizePoolHeadlinePen} animate />
              <span aria-hidden="true">+</span>
            </p>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-[var(--hud-type)]/60 sm:mt-4">
              {prizesCopy.totalSuffix}
            </p>
            <dl className="mt-6 grid max-w-md grid-cols-2 gap-px bg-[var(--hud-type)]/15">
              <div className="bg-[#08070a]/80 p-4">
                <dt className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--hud-type)]/55">
                  1.er puesto
                </dt>
                <dd className="mt-2 font-display text-3xl leading-none">
                  {formatSoles(prizeAmountsPen.first)}
                </dd>
              </div>
              <div className="bg-[#08070a]/80 p-4">
                <dt className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--hud-type)]/55">
                  2.º puesto
                </dt>
                <dd className="mt-2 font-display text-3xl leading-none">
                  {formatSoles(prizeAmountsPen.second)}
                </dd>
              </div>
            </dl>
          </div>

          <p
            aria-hidden="true"
            className="hidden font-display text-[clamp(2rem,4vw,3.25rem)] leading-none text-[var(--hud-type)]/30 lg:block"
          >
            +
          </p>

          <div className="min-w-0">
            <h3 className="max-w-full font-display text-[clamp(2.75rem,8vw,4.5rem)] uppercase leading-[0.86] tracking-[-0.03em] lg:text-[clamp(2.25rem,5.2vw,4.5rem)]">
              <span className="sr-only">{prizesCopy.tripTitle}</span>
              {prizesCopy.tripLines.map((line) => (
                <span aria-hidden="true" className="block w-fit" key={line}>
                  {line}
                </span>
              ))}
            </h3>
            <p className="mt-3 font-mono text-xs tracking-[0.08em] text-[var(--hud-type)]/60 sm:mt-4">
              {prizesCopy.tripLocation}
            </p>
          </div>
        </div>

        <div className="mt-12 border-[var(--hud-type)]/15 border-t pt-8 sm:mt-16 sm:pt-10">
          <h3 className="font-display text-3xl uppercase leading-none sm:text-4xl">
            {devtoolCreditsCopy.title}
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--hud-type)]/60">
            {devtoolCreditsCopy.lede}
          </p>

          <div className="mt-7">
            <div className="grid gap-px bg-[var(--hud-type)]/15 lg:grid-cols-2">
              {devtoolPartners.map((partner) => (
                <article
                  className="bg-[#08070a]/80 p-6 sm:p-8"
                  key={partner.id}
                >
                  <a
                    className="inline-flex min-h-12 items-center transition-opacity hover:opacity-75"
                    href={partner.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Image
                      alt={partner.name}
                      className="h-auto max-h-10 w-auto max-w-[min(100%,18rem)] object-contain object-left"
                      height={partner.logoHeight}
                      src={partner.logoSrc}
                      width={partner.logoWidth}
                    />
                  </a>

                  <dl className="mt-7 grid gap-5 sm:grid-cols-2">
                    {partner.winnerPrizes.map((prize) => (
                      <div key={prize.place}>
                        <dt className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--hud-action)]">
                          {prize.place}
                        </dt>
                        <dd className="mt-2 text-base leading-snug sm:min-h-12">
                          {prize.prize}
                        </dd>
                        <dd className="mt-1 text-sm text-[var(--hud-type)]/55">
                          Valorado en {prize.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
            {devtoolPartners.map(
              (partner) =>
                partner.winnerNote && (
                  <p
                    className="mt-px bg-[#08070a]/80 p-6 text-sm leading-relaxed text-[var(--hud-type)]/70 sm:px-8"
                    key={partner.id}
                  >
                    <span className="font-mono uppercase tracking-[0.12em] text-[var(--hud-action)]">
                      {partner.name} · Premio individual
                    </span>{" "}
                    {partner.winnerNote}
                  </p>
                ),
            )}
          </div>
        </div>
      </BrandContainer>
    </section>
  );
}
