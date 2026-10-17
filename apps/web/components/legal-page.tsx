import {
  BrandContainer,
  BrandHeader,
  BrandKicker,
  BrandPage,
  BrandWordmarkLink,
} from "@chofex/ui/components/brand";
import { buttonVariants } from "@chofex/ui/components/button";
import Link from "next/link";
import {
  brandName,
  chromeCopy,
  legalCopy,
  legalNavigation,
} from "@/components/landing/content";
import { LandingFooter } from "@/components/landing/footer";
import { LandingSkipLinks } from "@/components/landing/skip-links";
import { LegalDocument } from "@/components/legal-document";

interface LegalPageProps {
  readonly children: string;
}

export function LegalPage({ children }: LegalPageProps) {
  return (
    <BrandPage className="landing-dark flex flex-col" id="top">
      <LandingSkipLinks applyHref="/#apply" />
      <BrandHeader>
        <BrandWordmarkLink href="/">{brandName}</BrandWordmarkLink>
        <nav
          aria-label={legalCopy.navigationLabel}
          className="flex flex-wrap items-center gap-3 font-mono text-xs uppercase tracking-[0.12em] sm:gap-5"
        >
          <Link
            className="text-[var(--hud-muted)] underline-offset-4 hover:text-[var(--hud-ink)] hover:underline"
            href="/"
          >
            {legalCopy.home}
          </Link>
          {legalNavigation.map((link) => (
            <Link
              className="text-[var(--hud-muted)] underline-offset-4 hover:text-[var(--hud-ink)] hover:underline"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
          <Link className={buttonVariants()} href="/#apply">
            {chromeCopy.apply}
          </Link>
        </nav>
      </BrandHeader>
      <main className="flex-1" id="contenido">
        <section className="bg-[var(--hud-paper)]">
          <BrandContainer className="py-14 sm:py-20">
            <BrandKicker className="mb-3 text-[var(--hud-kicker)]">
              {legalCopy.eventKicker}
            </BrandKicker>
            <article className="min-w-0 max-w-3xl">
              <LegalDocument>{children}</LegalDocument>
            </article>
          </BrandContainer>
        </section>
      </main>
      <LandingFooter sectionHrefPrefix="/" />
    </BrandPage>
  );
}
