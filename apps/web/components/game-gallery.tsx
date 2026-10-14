import { BrandContainer, BrandKicker } from "@chofex/ui/components/brand";
import { buttonVariants } from "@chofex/ui/components/button";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

const games = [
  {
    slug: "rocket-andes",
    title: "The Rocket Andes",
    creator: "Gondar / KeoIT",
    description:
      "Fútbol con autos cohete y mototaxis en seis escenarios del Perú. Juega con tus amigos en partidas online 1v1 y 2v2.",
    gameUrl: "https://rocketandes.keoit.com/",
    links: [
      { label: "Ver en TikTok", url: "https://vt.tiktok.com/ZSbWe2jXT/" },
    ],
  },
  {
    slug: "llama-roguelike",
    title: "Llama Roguelike",
    creator: "Alexander Ortega / aovks23",
    description:
      "Cruza los Andes con una llama y una mochila de objetos sagrados. Ordena tu inventario para multiplicar el poder de tus escupitajos y patadas. Juega en web o descárgalo para Windows.",
    gameUrl: "https://aovks23.itch.io/llama-roguelike-wip",
    links: [
      { label: "Ver en LinkedIn", url: "https://lnkd.in/p/eu8-2dYF" },
      {
        label: "Ver en X",
        url: "https://x.com/AlexanderO73639/status/2108345937550544979",
      },
      {
        label: "Ver tráiler",
        url: "https://www.youtube.com/watch?v=EgTdAntCf6k",
      },
    ],
  },
  {
    slug: "cuy-del-caos",
    title: "El Cuy del Caos",
    creator: "Cristopher Bazan y Elva Anni Diaz Regalado",
    description:
      "Un arcade roguelite de pixel art. Corre por el campus, haz travesuras y usa el dash y el sigilo para escapar de quienes te persiguen.",
    gameUrl: "https://cuydelcaos.netlify.app/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/dKbGRM2H" }],
  },
  {
    slug: "cuy-invaders",
    title: "Cuy Invaders",
    creator: "YordanSM",
    description:
      "Defiende el valle con tu cuy artillero. Enfrenta cabezas clavas y huacos con poderes como el jalapeño y el choclo misil, también desde tu celular.",
    gameUrl: "https://cuyinvader.onrender.com/",
    links: [
      {
        label: "Ver en LinkedIn",
        url: "https://www.linkedin.com/feed/update/urn:li:ugcPost:7515099931368521728/",
      },
    ],
  },
  {
    slug: "condor-andes",
    title: "Cóndor de los Andes",
    creator: "Roberto Zuñiga / Robertzu43",
    description:
      "Vuela entre las montañas en un juego de pixel art estilo Flappy. Junta cinco monedas Inti para activar ULTRA ANDES y duplicar tus puntos. Compite por entrar al TOP CONDORES.",
    gameUrl: "https://condor-andes.pages.dev/",
    links: [
      { label: "Ver en LinkedIn", url: "https://lnkd.in/p/epS5WFKp" },
      {
        label: "Ver código",
        url: "https://github.com/Robertzu43/condor-andes",
      },
    ],
  },
  {
    slug: "software-engineer-life",
    title: "Software Engineer LIFE",
    creator: "Binni Cordova",
    description:
      "Decide el rumbo de una vida de dev en Lima, de 2019 a 2026. Negocia, toma riesgos y cuida tu salud en un simulador de cuatro minutos pensado para juniors y estudiantes.",
    gameUrl: "https://binnicordova.github.io/software-engineer-life/",
    links: [
      { label: "Ver en TikTok", url: "https://vt.tiktok.com/ZSbT6maFb/" },
      {
        label: "Ver en X",
        url: "https://x.com/binnicordova/status/2109418794842312800?s=46",
      },
      {
        label: "Perfil en LinkedIn",
        url: "https://www.linkedin.com/in/binnicordova",
      },
    ],
  },
  {
    slug: "lgtm-no-rompas-produccion",
    title: "LGTM? No rompas producción",
    creator: "David Rodriguez",
    description:
      "Revisa diez pull requests con veinte segundos para decidir si mergear o bloquear. Evita daños ficticios y descubre tu arquetipo de revisor en una partida sin registro.",
    gameUrl: "https://lgtm-no-rompas-produccion.vercel.app/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/dehPd2r4" }],
  },
  {
    slug: "llamisueltas",
    title: "Llamisueltas",
    creator: "Christian Frisancho",
    description:
      "Haz parkour entre azoteas y deslízate por cables en un juego multijugador de combate urbano. Consigue comida para evolucionar tu llama, desbloquea habilidades y esquiva la combi.",
    gameUrl: "https://llamisueltas.onrender.com/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/d4CRUJ-H" }],
  },
  {
    slug: "fighterverse",
    title: "Fighterverse",
    creator: "Luis Angelo Rodriguez",
    description:
      "Un juego de peleas 2D para jugar online con amigos. Convierte una foto en tu propio luchador con IA y entra a la arena con sus animaciones.",
    gameUrl: "https://fighterverse.cuisangelo.com/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/eaqtGx2C" }],
  },
  {
    slug: "combi-loca",
    title: "Combi Loca",
    creator: "Jorge Laban",
    description:
      "Maneja tu combi por Lima, esquiva el tráfico y recoge pasajeros. Recauda sin chocar y compite por llegar al ranking de los mejores cobradores.",
    gameUrl: "https://combi-loca.pages.dev/",
    links: [],
  },
  {
    slug: "andes-arena",
    title: "Andes Arena",
    creator: "Th3Kum4",
    description:
      "Una arena de plataformas y acción con tres oleadas y el Espíritu Ancestral como jefe. La semilla diaria permite competir por el mejor tiempo en el mismo escenario.",
    gameUrl: "https://cleverjohann.github.io/andes-arena/",
    links: [],
  },
  {
    slug: "volt-mates",
    title: "Volt-Mates",
    creator: "Yofer Corne Flores",
    description:
      "Dos jugadores unidos por un rayo de energía deben coordinarse para eliminar enemigos. Coopera en local u online, supera seis oleadas y enfrenta al jefe final.",
    gameUrl: "https://volt-mates.vercel.app/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/dVytzWnu" }],
  },
  {
    slug: "ichu",
    title: "Ichu",
    creator: "Luis Cardenas / Alej0",
    description:
      "Sal, guarda el celular y descubre animales andinos. Al volver, completa un reto de foto verificado por IA, colecciona cartas y reta a tus amigos a tocar pasto.",
    gameUrl: "https://ichu-app.vercel.app/",
    links: [
      { label: "Ver en LinkedIn", url: "https://lnkd.in/p/ectUqxsp" },
      { label: "Ver en TikTok", url: "https://vt.tiktok.com/ZSgJNjfLV" },
    ],
  },
];

export function GameGallery() {
  return (
    <section
      aria-labelledby="games-title"
      className="border-b border-border"
      id="games"
    >
      <BrandContainer className="py-16 sm:py-20">
        <BrandKicker className="mb-4 text-[var(--hud-accent)]">
          Hechos por la comunidad
        </BrandKicker>
        <h2
          className="font-display text-4xl uppercase sm:text-5xl"
          id="games-title"
        >
          Juega lo que estamos creando
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Prueba los juegos del reto y apoya a sus creadores en sus
          publicaciones. Todos se juegan desde el navegador.
        </p>
        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          {games.map((game) => (
            <li
              key={game.slug}
              className="flex flex-col border border-border bg-card"
            >
              <a
                aria-label={`Jugar ${game.title} (abre en una nueva pestaña)`}
                className="relative block aspect-[16/10] overflow-hidden border-b border-border"
                href={game.gameUrl}
                rel="noreferrer"
                target="_blank"
              >
                <Image
                  alt={`Vista previa de ${game.title}`}
                  className="object-cover transition-transform duration-200 motion-safe:hover:scale-105"
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  src={`/game/previews/${game.slug}.webp`}
                />
              </a>
              <div className="flex flex-1 flex-col p-6 sm:p-8">
                <h3 className="text-2xl font-medium">{game.title}</h3>
                <p className="mt-2 text-sm text-[var(--hud-accent)]">
                  {game.creator}
                </p>
                <p className="mt-4 flex-1 leading-relaxed text-muted-foreground">
                  {game.description}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <a
                    aria-label={`Jugar ${game.title} (abre en una nueva pestaña)`}
                    className={`${buttonVariants()} whitespace-nowrap`}
                    href={game.gameUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Jugar <ArrowUpRight aria-hidden="true" className="size-4" />
                  </a>
                  {game.links.map((link) => (
                    <a
                      key={link.url}
                      aria-label={`${link.label}: ${game.title} (abre en una nueva pestaña)`}
                      className="inline-flex items-center gap-1 whitespace-nowrap text-sm underline underline-offset-4 hover:text-[var(--hud-accent)]"
                      href={link.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {link.label}
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </a>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </BrandContainer>
    </section>
  );
}
