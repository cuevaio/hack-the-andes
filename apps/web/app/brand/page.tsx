import {
  BrandContainer,
  BrandFrame,
  BrandHeader,
  BrandKicker,
  BrandPage,
  BrandTitle,
  BrandWordmarkLink,
} from "@chofex/ui/components/brand";
import { buttonVariants } from "@chofex/ui/components/button";
import { brandColors } from "@chofex/ui/lib/brand-theme";
import { ArrowDownToLine, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  brandName,
  facts,
  partners,
  sponsorsCopy,
} from "@/components/landing/content";
import { LandingFooter } from "@/components/landing/footer";
import { LandingSkipLinks } from "@/components/landing/skip-links";

const title = "Marca y kit de prensa | Hack the Andes";
const description =
  "Logos, colores, tipografías y recursos de Hack the Andes. Descarga el kit de prensa con los datos del evento y materiales para compartir.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/brand" },
  openGraph: { title, description, url: "/brand" },
  twitter: { title, description },
};

const wordmarks = [
  {
    name: "Sobre fondo oscuro",
    variant: "light",
    background: brandColors.dark.paper,
  },
  {
    name: "Sobre fondo claro",
    variant: "dark",
    background: brandColors.light.paper,
  },
];

const colors = [
  { name: "Fondo", value: brandColors.dark.paper },
  { name: "Texto", value: brandColors.dark.ink },
  { name: "Acciones", value: brandColors.dark.action },
  { name: "Acento", value: brandColors.dark.status },
  { name: "Arena", value: brandColors.dark.accent },
];

const fonts = [
  {
    name: "Stack Sans Notch",
    role: "Nombre del evento",
    sample: "Hack the Andes",
    className: "font-brand",
    href: "https://fonts.google.com/specimen/Stack+Sans+Notch",
  },
  {
    name: "Barlow Condensed",
    role: "Títulos",
    sample: "Construye en los Andes",
    className: "font-display uppercase",
    href: "https://fonts.google.com/specimen/Barlow+Condensed",
  },
  {
    name: "Google Sans Flex",
    role: "Texto",
    sample: "30 horas, una entrega funcionando.",
    className: "font-sans",
    href: "https://fonts.google.com/specimen/Google+Sans+Flex",
  },
  {
    name: "IBM Plex Mono",
    role: "Etiquetas y datos",
    sample: "LIMA · 17–18 OCT 2026",
    className: "font-mono",
    href: "https://fonts.google.com/specimen/IBM+Plex+Mono",
  },
];

function DownloadLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: React.ReactNode;
}) {
  return (
    <a
      className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-primary underline-offset-4 hover:underline"
      download
      href={href}
    >
      <ArrowDownToLine aria-hidden="true" className="size-4" />
      {children}
    </a>
  );
}

export default function BrandAssetsPage() {
  return (
    <BrandPage id="top">
      <LandingSkipLinks applyHref="/#apply" />
      <BrandHeader>
        <BrandWordmarkLink href="/">{brandName}</BrandWordmarkLink>
        <nav
          aria-label="Marca y prensa"
          className="flex flex-wrap gap-5 text-sm"
        >
          <Link className="hover:underline" href="/">
            Inicio
          </Link>
          <a className="hover:underline" href="#logos">
            Logos
          </a>
          <a className="hover:underline" href="#media-kit">
            Kit de prensa
          </a>
        </nav>
      </BrandHeader>
      <main id="contenido">
        <section className="border-b border-border py-16 sm:py-24">
          <BrandContainer>
            <BrandKicker className="mb-6 text-primary">
              Marca y recursos
            </BrandKicker>
            <BrandTitle as="h1" className="max-w-4xl text-6xl sm:text-8xl">
              Todo para compartir Hack the Andes
            </BrandTitle>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Logos, identidad visual y materiales para prensa, aliados y
              comunidad. Descarga el kit completo o el recurso que necesitas.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <a
                className={buttonVariants({ size: "lg" })}
                download
                href="/brand/hack-the-andes-media-kit.zip"
              >
                <ArrowDownToLine aria-hidden="true" />
                Descargar kit de prensa
              </a>
              <span className="text-sm text-muted-foreground">
                ZIP · SVG, PNG, imágenes y ficha del evento
              </span>
            </div>
          </BrandContainer>
        </section>

        <BrandContainer className="space-y-20 py-16 sm:py-20">
          <section aria-labelledby="logos-title" id="logos">
            <BrandKicker className="mb-3 text-primary">01 / Logos</BrandKicker>
            <BrandTitle id="logos-title">El nombre, tal cual</BrandTitle>
            <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">
              Escribe siempre &quot;Hack the Andes&quot;. Los SVG tienen el
              texto convertido a trazados y los PNG tienen fondo transparente.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {wordmarks.map((wordmark) => (
                <BrandFrame key={wordmark.variant}>
                  <div
                    className="flex h-52 items-center justify-center p-8 sm:p-12"
                    style={{ backgroundColor: wordmark.background }}
                  >
                    <Image
                      alt={`Hack the Andes, versión ${wordmark.name.toLowerCase()}`}
                      className="h-auto w-full"
                      height={240}
                      src={`/brand/hack-the-andes-${wordmark.variant}.svg`}
                      unoptimized
                      width={1200}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-5">
                    <h3 className="text-sm">{wordmark.name}</h3>
                    <div className="flex gap-5">
                      <DownloadLink
                        href={`/brand/hack-the-andes-${wordmark.variant}.svg`}
                      >
                        SVG
                      </DownloadLink>
                      <DownloadLink
                        href={`/brand/hack-the-andes-${wordmark.variant}.png`}
                      >
                        PNG
                      </DownloadLink>
                    </div>
                  </div>
                </BrandFrame>
              ))}
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Conserva las proporciones y deja espacio libre alrededor. Usa la
              versión clara sobre fondos oscuros y la oscura sobre fondos
              claros. Mantén el color original, sin sombras ni contornos.
            </p>
          </section>

          <section aria-labelledby="identity-title">
            <BrandKicker className="mb-3 text-primary">
              02 / Identidad
            </BrandKicker>
            <BrandTitle id="identity-title">Colores y tipografías</BrandTitle>
            <p className="mt-5 text-muted-foreground">
              La paleta del sitio sobre fondo oscuro. Cada color tiene un rol.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {colors.map((color) => (
                <BrandFrame key={color.name}>
                  <div
                    aria-hidden="true"
                    className="h-28 border-b border-border"
                    style={{ backgroundColor: color.value }}
                  />
                  <div className="space-y-1 p-4">
                    <h3 className="text-sm">{color.name}</h3>
                    <code className="text-sm text-muted-foreground">
                      {color.value}
                    </code>
                  </div>
                </BrandFrame>
              ))}
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {fonts.map((font) => (
                <BrandFrame className="p-6" key={font.name}>
                  <p className="text-xs text-muted-foreground">{font.role}</p>
                  <p className={`my-5 text-2xl sm:text-3xl ${font.className}`}>
                    {font.sample}
                  </p>
                  <a
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    href={font.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {font.name}
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </a>
                </BrandFrame>
              ))}
            </div>
          </section>

          <section aria-labelledby="media-title" id="media-kit">
            <BrandKicker className="mb-3 text-primary">
              03 / Kit de prensa
            </BrandKicker>
            <BrandTitle id="media-title">Datos para publicar</BrandTitle>
            <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <p className="text-lg leading-relaxed">
                  Hack the Andes es una hackathon presencial en Lima, Perú, para
                  AI, product y software engineers. Reúne a 100 participantes
                  durante 30 horas para construir y entregar un producto
                  funcionando. Se realiza el 17 y 18 de octubre de 2026, con
                  equipos de 1 a 4 personas y 3 tracks que se revelan al iniciar
                  la hackathon.
                </p>
                <p className="mt-5 leading-relaxed text-muted-foreground">
                  {sponsorsCopy.lede}
                </p>
                <div className="mt-6">
                  <DownloadLink href="/brand/media-kit.txt">
                    Descargar ficha de prensa
                  </DownloadLink>
                </div>
              </div>
              <BrandFrame className="p-6">
                <dl className="space-y-4">
                  {facts.map((fact) => (
                    <div
                      className="flex justify-between gap-5"
                      key={fact.label}
                    >
                      <dt className="text-muted-foreground">{fact.label}</dt>
                      <dd className="text-right font-mono text-sm">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-5">
                    <dt className="text-muted-foreground">Lugar</dt>
                    <dd className="text-right">Lima, Perú</dd>
                  </div>
                </dl>
                <p className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">
                  Sede exacta por anunciar. Consulta el sitio antes de publicar
                  información sobre la sede.
                </p>
              </BrandFrame>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <BrandFrame>
                <Image
                  alt="Imagen de Hack the Andes para compartir en redes"
                  className="aspect-[1200/675] w-full object-cover"
                  height={675}
                  src="/opengraph-image.jpg"
                  width={1200}
                />
                <div className="space-y-3 border-t border-border p-5">
                  <h3>Imagen para redes</h3>
                  <p className="text-sm text-muted-foreground">
                    JPG · 1200 × 675 px
                  </p>
                  <DownloadLink href="/opengraph-image.jpg">
                    Descargar imagen
                  </DownloadLink>
                </div>
              </BrandFrame>
              <BrandFrame>
                <Image
                  alt="Ilustración del relieve de los Andes"
                  className="aspect-[1200/675] w-full object-cover"
                  height={675}
                  src="/brand/andes-ridge.png"
                  width={1200}
                />
                <div className="space-y-3 border-t border-border p-5">
                  <h3>Arte de los Andes</h3>
                  <p className="text-sm text-muted-foreground">
                    Ilustración de marca. No es una fotografía de la sede.
                  </p>
                  <DownloadLink href="/brand/andes-ridge.png">
                    Descargar arte
                  </DownloadLink>
                </div>
              </BrandFrame>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Relieve de Mapzen Terrain Tiles; datos SRTM del U.S. Geological
              Survey.{" "}
              <Link className="text-primary hover:underline" href="/credits">
                Ver créditos
              </Link>
              .
            </p>
          </section>

          <section aria-labelledby="partners-title">
            <BrandKicker className="mb-3 text-primary">
              04 / Organizaciones
            </BrandKicker>
            <BrandTitle id="partners-title">Quiénes lo hacen</BrandTitle>
            <p className="mt-5 text-muted-foreground">
              Usa los logos originales y conserva el rol de cada organización.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {partners.map((partner) => (
                <BrandFrame className="flex flex-col" key={partner.id}>
                  <div className="flex h-48 items-center justify-center bg-[#050406] p-8">
                    <Image
                      alt={partner.name}
                      className="max-h-28 w-auto max-w-full object-contain"
                      height={partner.logoHeight}
                      src={partner.logoSrc}
                      width={partner.logoWidth}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 border-t border-border p-5">
                    <h3>{partner.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {partner.role}
                    </p>
                    <DownloadLink href={partner.logoSrc}>
                      Descargar PNG
                    </DownloadLink>
                    {partner.id === "chofex" && (
                      <DownloadLink href={sponsorsCopy.logoOnLightSrc}>
                        PNG para fondo claro
                      </DownloadLink>
                    )}
                  </div>
                </BrandFrame>
              ))}
            </div>
          </section>

          <BrandFrame className="flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="text-xl">¿Necesitas más material?</h2>
              <p className="mt-2 text-muted-foreground">
                Contacta al equipo en nuestra comunidad para consultas de
                prensa.
              </p>
            </div>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/discord"
            >
              Contactar al equipo
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </BrandFrame>
        </BrandContainer>
      </main>
      <LandingFooter sectionHrefPrefix="/" />
    </BrandPage>
  );
}
