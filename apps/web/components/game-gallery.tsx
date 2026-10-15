import { BrandContainer, BrandKicker } from "@chofex/ui/components/brand";
import { buttonVariants } from "@chofex/ui/components/button";
import { ArrowUpRight, Gamepad2 } from "lucide-react";
import Image from "next/image";
import {
  gameLikesCheckedAt,
  gamePostLikes,
  gamePostLikesNeedRecheck,
  previousGameLikesCheckedAt,
  rankGames,
} from "@/lib/game-post-likes";

const games = [
  {
    slug: "rocket-andes",
    previewUrl: "/game/previews/rocket-andes.webp",
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
    previewUrl: "/game/previews/llama-roguelike.webp",
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
    previewUrl: "/game/previews/cuy-del-caos.webp",
    title: "El Cuy del Caos",
    creator: "Cristopher Bazan y Elva Anni Diaz Regalado",
    description:
      "Un arcade roguelite de pixel art. Corre por el campus, haz travesuras y usa el dash y el sigilo para escapar de quienes te persiguen.",
    gameUrl: "https://cuydelcaos.netlify.app/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/dKbGRM2H" }],
  },
  {
    slug: "cuy-invaders",
    previewUrl: "/game/previews/cuy-invaders.webp",
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
    previewUrl: "/game/previews/condor-andes.webp",
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
    previewUrl: "/game/previews/software-engineer-life.webp",
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
        label: "Ver en LinkedIn",
        url: "https://lnkd.in/p/devXPAmv",
      },
    ],
  },
  {
    slug: "lgtm-no-rompas-produccion",
    previewUrl: "/game/previews/lgtm-no-rompas-produccion.webp",
    title: "LGTM? No rompas producción",
    creator: "David Rodriguez",
    description:
      "Revisa diez pull requests con veinte segundos para decidir si mergear o bloquear. Evita daños ficticios y descubre tu arquetipo de revisor en una partida sin registro.",
    gameUrl: "https://lgtm-no-rompas-produccion.vercel.app/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/dehPd2r4" }],
  },
  {
    slug: "llamisueltas",
    previewUrl: "/game/previews/llamisueltas.webp",
    title: "Llamisueltas",
    creator: "Christian Frisancho",
    description:
      "Haz parkour entre azoteas y deslízate por cables en un juego multijugador de combate urbano. Consigue comida para evolucionar tu llama, desbloquea habilidades y esquiva la combi.",
    gameUrl: "https://llamisueltas.onrender.com/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/d4CRUJ-H" }],
  },
  {
    slug: "fighterverse",
    previewUrl: "/game/previews/fighterverse.webp",
    title: "Fighterverse",
    creator: "Luis Angelo Rodriguez",
    description:
      "Un juego de peleas 2D para jugar online con amigos. Convierte una foto en tu propio luchador con IA y entra a la arena con sus animaciones.",
    gameUrl: "https://fighterverse.cuisangelo.com/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/eaqtGx2C" }],
  },
  {
    slug: "combi-loca",
    previewUrl: "/game/previews/combi-loca.webp",
    title: "Combi Loca",
    creator: "Jorge Laban",
    description:
      "Maneja tu combi por Lima, esquiva el tráfico y recoge pasajeros. Recauda sin chocar y compite por llegar al ranking de los mejores cobradores.",
    gameUrl: "https://combi-loca.pages.dev/",
    links: [],
  },
  {
    slug: "andes-arena",
    previewUrl: "/game/previews/andes-arena.webp",
    title: "Andes Arena",
    creator: "Th3Kum4",
    description:
      "Una arena de plataformas y acción con tres oleadas y el Espíritu Ancestral como jefe. La semilla diaria permite competir por el mejor tiempo en el mismo escenario.",
    gameUrl: "https://cleverjohann.github.io/andes-arena/",
    links: [],
  },
  {
    slug: "volt-mates",
    previewUrl: "/game/previews/volt-mates.webp",
    title: "Volt-Mates",
    creator: "Yofer Corne Flores",
    description:
      "Dos jugadores unidos por un rayo de energía deben coordinarse para eliminar enemigos. Coopera en local u online, supera seis oleadas y enfrenta al jefe final.",
    gameUrl: "https://volt-mates.vercel.app/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/dVytzWnu" }],
  },
  {
    slug: "ichu",
    previewUrl: "/game/previews/ichu.webp",
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
  {
    slug: "vibecoder-latam",
    previewUrl: null,
    title: "VIBECODER: LATAM",
    creator: "Jorge Nureña / Georsh",
    description:
      "Un RPG de pixel art donde eres un founder peruano. Programa de madrugada en Lima, consigue tu primera laptop, convence inversionistas y llega al Demo Day en San Francisco. Se juega en PC con teclado.",
    gameUrl: "https://vibecoder-latam-web.vercel.app/",
    links: [
      {
        label: "Ver en LinkedIn",
        url: "https://www.linkedin.com/feed/update/urn:li:activity:7516041882490142720/",
      },
      {
        label: "Ver en Instagram",
        url: "https://www.instagram.com/p/DeecQ9vG2Ct/",
      },
    ],
  },
  {
    slug: "ultimo-deploy",
    previewUrl: null,
    title: "Último Deploy",
    creator: "Luis.T",
    description:
      "Elige un cuy o una llama hacker con chullo y salva la demo antes del deadline. Recorre los talleres de la comunidad, escolta la combi y lanza un mototaxi contra los bugs. Al ganar recibes una credencial con tu tiempo.",
    gameUrl: "https://ultimo-deploy.vercel.app/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/e4VDQCrU" }],
  },
  {
    slug: "kuntur",
    previewUrl: null,
    title: "KUNTUR: Guardianes del Perú",
    creator: "Edwin Soto",
    description:
      "Rescata animales del Perú usando tu cuerpo y tu cámara. Aletea para volar como un cóndor y abre la boca para morder como un zorro. Las imágenes se procesan en tu equipo.",
    gameUrl: "https://kuntur.vigiaperu.workers.dev/jugar/",
    links: [
      {
        label: "Ver en LinkedIn",
        url: "https://www.linkedin.com/feed/update/urn:li:activity:7516185183210037248/",
      },
    ],
  },
  {
    slug: "pachabyte",
    previewUrl: null,
    title: "PachaByte",
    creator: "AndrewMechDev",
    description:
      "Un arcade de pixel art inspirado en Space Impact. Guía a Kipu por las regiones del Perú, ralentiza el tiempo con PachaShift y devuelve los proyectiles de las criaturas digitales que amenazan su mundo.",
    gameUrl: "https://andrewmechdev.github.io/pachabyte/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/eakSQ98F" }],
  },
  {
    slug: "maraton-andes",
    previewUrl: null,
    title: "La Maratón de los Andes",
    creator: "Harold Medrano y Héctor Zerrillo",
    description:
      "Llega al colegio antes de las ocho en una aventura de pixel art por los Andes, Lima, Machu Picchu y la Amazonía. Cuatro capítulos con jergas, voces y música peruana.",
    gameUrl: "https://maraton-andes.haroldmedrano33.workers.dev/",
    links: [
      {
        label: "Ver en LinkedIn",
        url: "https://www.linkedin.com/posts/hector-zerrillo_hacktheandes-gamedev-pixelart-share-7515546680428027904-lBgS/",
      },
    ],
  },
  {
    slug: "kill-can-a-cuna",
    previewUrl: null,
    title: "Kill can a cuna, one tank and a cuy",
    creator: "Dante / Minimum Viable Slop",
    description:
      "Un juego de lapiceros por turnos inspirado en la vida escolar peruana. Enfréntate a tus amigos con arte inspirado en el indigenismo, escenarios andinos y rivales coleccionables.",
    gameUrl: "https://mivis-lapices.pages.dev/",
    links: [{ label: "Ver en LinkedIn", url: "https://lnkd.in/p/dF6-DPhp" }],
  },
  {
    slug: "mimix-cuy",
    previewUrl: null,
    title: "Mimix Cuy",
    creator: "Edwar Silva",
    description:
      "Un cuy con chullo corre por el espacio. Esquiva obstáculos, salta y recoge monedas con el teclado o moviéndote frente a la cámara. Se juega desde PC.",
    gameUrl: "https://mimix-cuy.vercel.app/",
    links: [
      {
        label: "Ver en LinkedIn",
        url: "https://www.linkedin.com/feed/update/urn:li:activity:7516319431329804289/",
      },
    ],
  },
];

const rankedGames = rankGames(games);
const checkedAtLabel = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Lima",
}).format(new Date(gameLikesCheckedAt));
const previousCheckedAtLabel = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Lima",
}).format(new Date(previousGameLikesCheckedAt));

function TikTokCountNote() {
  return (
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
      TikTok no permitió confirmar los likes en esta revisión. Sus conteos
      visibles son del {previousCheckedAtLabel} (Lima). El TikTok de Software
      Engineer LIFE y la publicación de LinkedIn del juego de lapiceros quedan
      sin conteo verificable.
    </p>
  );
}

export function GameRanking() {
  return (
    <section aria-labelledby="game-ranking-title" className="mt-8 max-w-xl">
      <h2 id="game-ranking-title" className="text-xl font-medium">
        Ranking provisional
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        La publicación con más likes de cada juego. En LinkedIn contamos todas
        las reacciones.
      </p>
      <table className="mt-4 w-full text-left text-sm">
        <caption className="caption-bottom pt-3 text-left text-xs text-muted-foreground">
          Conteo manual del{" "}
          <time dateTime={gameLikesCheckedAt}>{checkedAtLabel}</time> (Lima).
        </caption>
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="pb-2 pr-3 font-normal">
              Puesto
            </th>
            <th scope="col" className="pb-2 pr-3 font-normal">
              Juego
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              Likes / reacciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rankedGames.map((game) => (
            <tr key={game.slug}>
              <td className="py-2 pr-3 font-mono text-[var(--hud-accent)]">
                {game.rank ?? "Pendiente"}
              </td>
              <th scope="row" className="py-2 pr-3 font-normal">
                <a
                  href={`#game-${game.slug}`}
                  className="underline underline-offset-4 hover:text-[var(--hud-accent)]"
                >
                  {game.title}
                </a>
              </th>
              <td className="py-2 text-right font-mono tabular-nums">
                {game.likes ?? "Sin conteo"}
                {game.links.some(({ url }) =>
                  gamePostLikesNeedRecheck.has(url),
                ) && (
                  <span className="block text-xs text-muted-foreground">
                    TikTok pendiente
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <TikTokCountNote />
    </section>
  );
}

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
          Ranking de juegos
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Ordenados por la publicación con más likes verificados de cada juego.
          En LinkedIn contamos todas las reacciones. Los empates comparten
          puesto. Prueba los juegos y apoya a sus creadores.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Conteo manual del{" "}
          <time dateTime={gameLikesCheckedAt}>{checkedAtLabel}</time> (hora de
          Lima). Ranking provisional, sin actualización automática. Los conteos
          pendientes no equivalen a cero.
        </p>
        <TikTokCountNote />
        <ol className="mt-10 grid gap-6 md:grid-cols-2">
          {rankedGames.map((game) => {
            let rankLabel = "Sin puesto · conteo pendiente";
            if (game.rank !== null) {
              let metricLabel = "likes / reacciones";
              if (game.likes === 1) metricLabel = "like / reacción";
              rankLabel = `#${game.rank} · ${game.likes} ${metricLabel}`;
              if (
                game.links.some(({ url }) => gamePostLikesNeedRecheck.has(url))
              ) {
                rankLabel += " · TikTok pendiente";
              }
            }
            if (game.links.length === 0)
              rankLabel = "Sin puesto · sin publicación";
            return (
              <li
                key={game.slug}
                id={`game-${game.slug}`}
                className="flex scroll-mt-6 flex-col border border-border bg-card"
              >
                <p className="border-b border-border px-6 py-3 font-mono text-sm text-[var(--hud-accent)]">
                  {rankLabel}
                </p>
                <a
                  aria-label={`Jugar ${game.title} (abre en una nueva pestaña)`}
                  className="relative block aspect-[16/10] overflow-hidden border-b border-border"
                  href={game.gameUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {game.previewUrl !== null && (
                    <Image
                      alt={`Vista previa de ${game.title}`}
                      className="object-cover transition-transform duration-200 motion-safe:hover:scale-105"
                      fill
                      sizes="(max-width: 767px) 100vw, 50vw"
                      src={game.previewUrl}
                    />
                  )}
                  {game.previewUrl === null && (
                    <div className="flex h-full flex-col items-center justify-center gap-5 bg-[radial-gradient(ellipse_at_top,rgba(111,155,255,0.16),transparent_75%)] px-8 text-center">
                      <Gamepad2
                        aria-hidden="true"
                        className="size-12 text-[var(--hud-accent)]"
                        strokeWidth={1}
                      />
                      <span className="font-display text-4xl uppercase">
                        {game.title}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Jugar en el navegador
                      </span>
                    </div>
                  )}
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
                      Jugar{" "}
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </a>
                    {game.links.map((link) => {
                      const likes = gamePostLikes.get(link.url);
                      let countLabel = null;
                      if (likes !== undefined) {
                        let metric = likes === 1 ? "like" : "likes";
                        if (link.label === "Ver en LinkedIn") {
                          metric = likes === 1 ? "reacción" : "reacciones";
                        }
                        countLabel = `${likes} ${metric}`;
                        if (gamePostLikesNeedRecheck.has(link.url)) {
                          countLabel = `Último conteo: ${likes} ${metric} · pendiente de reconfirmar`;
                        }
                      } else if (link.label !== "Ver código") {
                        countLabel = "Conteo no disponible";
                      }
                      return (
                        <span
                          key={link.url}
                          className="inline-flex flex-col gap-1"
                        >
                          <a
                            aria-label={`${link.label}: ${game.title} (abre en una nueva pestaña)`}
                            className="inline-flex items-center gap-1 whitespace-nowrap text-sm underline underline-offset-4 hover:text-[var(--hud-accent)]"
                            href={link.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {link.label}
                            <ArrowUpRight
                              aria-hidden="true"
                              className="size-4"
                            />
                          </a>
                          {countLabel !== null && (
                            <span className="text-xs text-muted-foreground">
                              {countLabel}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </BrandContainer>
    </section>
  );
}
