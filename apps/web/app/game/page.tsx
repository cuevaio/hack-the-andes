import {
  BrandContainer,
  BrandHeader,
  BrandKicker,
  BrandPage,
  BrandTitle,
  BrandWordmarkLink,
} from "@chofex/ui/components/brand";
import { buttonVariants } from "@chofex/ui/components/button";
import { ArrowUpRight, Gamepad2, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter } from "@/components/landing/footer";
import { LandingSkipLinks } from "@/components/landing/skip-links";

const title = "Vibecodea un juego. Gana US$100 | Hack the Andes";
const description =
  "Construye un juego, publícalo con #HackTheAndes y compártelo en Discord. El creador del juego más viral gana US$100 y un pase directo a Hack the Andes.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/game" },
  openGraph: {
    title,
    description,
    url: "/game",
    locale: "es_PE",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

const steps = [
  {
    number: "01",
    title: "Construye tu juego",
    description:
      "Vibecodea un juego que podamos jugar el día del evento. Usa tu agente y las herramientas que prefieras para darle vida a tu idea.",
  },
  {
    number: "02",
    title: "Publícalo con #HackTheAndes",
    description:
      "Comparte tu juego en cualquier red social con el hashtag #HackTheAndes. Invita a la gente a jugarlo y a compartir tu publicación.",
  },
  {
    number: "03",
    title: "Compártelo en Discord",
    description:
      "Comparte el enlace a tu publicación en nuestro Discord e incluye también el enlace para jugarlo. Así podremos probar lo que construiste.",
  },
];

export default function GamePage() {
  return (
    <BrandPage className="flex flex-col" id="top">
      <LandingSkipLinks applyHref="/#apply" />
      <BrandHeader>
        <BrandWordmarkLink href="/">Hack the Andes</BrandWordmarkLink>
        <nav
          aria-label="Navegación del reto"
          className="flex items-center gap-5"
        >
          <Link
            className="text-sm text-muted-foreground hover:text-foreground"
            href="/"
          >
            La hackathon
          </Link>
          <Link className={buttonVariants()} href="/discord">
            Ir a Discord
          </Link>
        </nav>
      </BrandHeader>
      <main className="flex-1" id="contenido">
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(111,155,255,0.12),transparent_65%)]"
          />
          <BrandContainer className="relative grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <BrandKicker className="mb-6 text-[var(--hud-accent)]">
                Reto de juegos / 17 de octubre de 2026 / Lima
              </BrandKicker>
              <BrandTitle as="h1" className="max-w-3xl text-6xl sm:text-8xl">
                Vibecodea
                <br />
                un juego.
              </BrandTitle>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Una nueva forma de ganarte tu lugar en Hack the Andes. Construye
                un juego que podamos jugar el día del evento.
              </p>
              <Link
                className={`${buttonVariants()} mt-8 whitespace-nowrap`}
                href="/discord"
              >
                Compartir mi juego{" "}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
              <p className="mt-3 text-sm text-muted-foreground">
                Publica tu juego y comparte los enlaces en Discord.
              </p>
            </div>
            <aside
              aria-label="Premio del reto"
              className="relative border border-[var(--hud-accent)]/40 bg-card p-8 sm:p-10"
            >
              <Gamepad2
                aria-hidden="true"
                strokeWidth={1}
                className="mb-10 size-20 text-[var(--hud-accent)]"
              />
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                El juego más viral gana
              </p>
              <p className="mt-4 font-display text-7xl leading-none sm:text-8xl">
                US$100
              </p>
              <p className="mt-4 flex items-center gap-3 text-xl">
                <Trophy
                  aria-hidden="true"
                  className="size-5 shrink-0 text-[var(--hud-accent)]"
                />
                + un pase directo a la hackathon
              </p>
              <p className="mt-8 border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
                Queremos jugar lo que construyas el sábado 17 de octubre en
                Lima.
              </p>
            </aside>
          </BrandContainer>
        </section>
        <section aria-labelledby="participate-title">
          <BrandContainer className="py-16 sm:py-20">
            <BrandKicker className="mb-4">
              Tu idea, tu juego, tu pase
            </BrandKicker>
            <h2
              id="participate-title"
              className="font-display text-4xl uppercase sm:text-5xl"
            >
              Cómo participar
            </h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((step) => (
                <li key={step.number} className="border-t border-border pt-6">
                  <span
                    aria-hidden="true"
                    className="font-mono text-sm text-[var(--hud-accent)]"
                  >
                    {step.number}
                  </span>
                  <h3 className="mt-5 text-xl font-medium">{step.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </BrandContainer>
        </section>
        <section
          aria-labelledby="ready-title"
          className="border-t border-border bg-card"
        >
          <BrandContainer className="flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <h2 id="ready-title" className="text-2xl font-medium">
                ¿Listo para que juguemos tu creación?
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Incluye los dos enlaces: tu publicación con #HackTheAndes y tu
                juego. Si tienes preguntas sobre el reto, escríbenos en Discord.
              </p>
            </div>
            <Link
              className={`${buttonVariants()} shrink-0 whitespace-nowrap`}
              href="/discord"
            >
              Ir a Discord{" "}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </BrandContainer>
        </section>
      </main>
      <LandingFooter sectionHrefPrefix="/" />
    </BrandPage>
  );
}
