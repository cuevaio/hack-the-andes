import {
  BrandFooter,
  BrandKicker,
  BrandWordmark,
} from "@chofex/ui/components/brand";
import Link from "next/link";

import {
  brandName,
  footerCopy,
  footerNavigation,
} from "@/components/landing/content";

function footerHref(href: string, sectionHrefPrefix: string): string {
  if (href.startsWith("#")) {
    return `${sectionHrefPrefix}${href}`;
  }

  return href;
}

export function LandingFooter({
  sectionHrefPrefix = "",
}: {
  readonly sectionHrefPrefix?: string;
}) {
  const applyHref = `${sectionHrefPrefix}#apply`;

  return (
    <BrandFooter className="landing-footer border-[var(--hud-type)]/15 bg-[#08070a] text-[var(--hud-type)]">
      <div className="grid gap-x-12 gap-y-12 border-[var(--hud-type)]/15 border-b py-6 pb-12 lg:grid-cols-[minmax(16rem,1.5fr)_minmax(0,4fr)] lg:py-10 lg:pb-14">
        <div className="max-w-xs">
          <BrandWordmark className="text-3xl text-[var(--hud-type)]">
            {brandName}
          </BrandWordmark>
          <BrandKicker className="mt-5 text-[var(--hud-accent)]">
            {footerCopy.meta}
          </BrandKicker>
          <p className="mt-3 text-sm leading-relaxed text-[var(--hud-type)]/65">
            {footerCopy.tagline}
          </p>
        </div>

        <nav
          aria-label={footerCopy.navigationLabel}
          className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4"
        >
          {footerNavigation.map((group) => (
            <div key={group.label}>
              <h2 className="text-sm font-semibold text-[var(--hud-type)]">
                {group.label}
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                {group.links.map((item) => (
                  <li key={item.href}>
                    <Link
                      className="text-[var(--hud-type)]/65 underline-offset-4 transition-colors hover:text-[var(--hud-type)] hover:underline"
                      href={footerHref(item.href, sectionHrefPrefix)}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <nav
        aria-label="Participación en el evento"
        className="flex flex-wrap gap-5 py-5 text-sm"
      >
        <Link className="underline underline-offset-4" href="/guide">
          Guía para equipos
        </Link>
        <Link
          className="underline underline-offset-4"
          href="/participation-terms"
        >
          Entrega y presentación
        </Link>
        <Link className="underline underline-offset-4" href="/projects">
          Proyectos
        </Link>
      </nav>

      <div className="flex flex-col gap-5 py-2 text-sm text-[var(--hud-type)]/60 md:flex-row md:items-center md:justify-between">
        <a
          className="inline-flex w-fit items-center gap-2 border border-[var(--hud-type)]/20 px-3 py-2 text-xs whitespace-nowrap text-[var(--hud-type)]/75 underline-offset-4 transition-colors hover:border-[var(--hud-type)]/35 hover:text-[var(--hud-type)] hover:underline"
          href={applyHref}
        >
          <span aria-hidden="true" className="size-2 bg-[var(--hud-action)]" />
          {footerCopy.applicationStatus}
          <span className="text-[var(--hud-type)]/60">
            · {footerCopy.applicationDeadline}
          </span>
        </a>
        <a
          className="text-xs underline-offset-4 transition-colors hover:text-[var(--hud-type)] hover:underline"
          href="https://crafter.run"
          rel="noreferrer"
          target="_blank"
        >
          {footerCopy.organizer}
        </a>
        <p className="text-xs">{footerCopy.copyright}</p>
      </div>
    </BrandFooter>
  );
}
