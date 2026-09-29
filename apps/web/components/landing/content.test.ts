import { expect, test } from "bun:test";
import { inflateSync } from "node:zlib";

import {
  applyCopy,
  brandName,
  chromeCopy,
  cliInstallMethods,
  cliNextCommands,
  devtoolCreditsCopy,
  devtoolPartners,
  discordCopy,
  eventCopy,
  eventItems,
  facts,
  faqItems,
  footerCopy,
  footerNavigation,
  formatSoles,
  heroCopy,
  legalCopy,
  metadataCopy,
  panelBrands,
  participantDevtoolPartners,
  participantPerks,
  participantPerksCopy,
  partners,
  peopleCopy,
  prizeAmountsPen,
  prizeAmountsUsd,
  prizesCopy,
  qualifierChallengeCount,
  qualifierChallengesCopy,
  seatCount,
  sectionNav,
  skipLinks,
  sponsorsCopy,
  trackCount,
  trackSeats,
  tracksCopy,
} from "./content";

test("offers curl and npm installation before the shared CLI flow", () => {
  expect(cliInstallMethods).toEqual([
    {
      id: "curl",
      label: "curl",
      description: "Recomendado · no requiere Node.js",
      hint: "Configura PATH y recarga tu terminal automáticamente.",
      command:
        "bash -o pipefail -c 'curl -fsSL https://hacktheandes.com/install | bash' && exec \"$SHELL\" -l",
    },
    {
      id: "npm",
      label: "npm",
      description: "Requiere Node.js 20 o superior",
      command: "npm install --global chofex-cli@latest",
    },
  ]);
  expect(cliNextCommands).toEqual([
    "chofex login",
    "chofex register",
    "chofex status",
  ]);
});

test("publishes the 17–18 octubre 2026 weekend in participant-facing copy", () => {
  const cuando = facts.find((fact) => fact.label === "Fecha");
  expect(cuando?.value).toBe("17–18 oct 2026");
  expect(metadataCopy.title).toContain("17–18 oct 2026");
  expect(heroCopy.metaDate).toBe("17–18 oct 2026");
  expect(heroCopy.metaLocation).toBe("Lima, Perú");
  expect(footerCopy.meta).toContain("17–18 oct 2026");
  expect(legalCopy.eventKicker).toContain("17–18 oct 2026");
  expect(legalCopy.eventKicker).toMatch(/Lima presencial/i);
  expect(
    footerNavigation.flatMap((group) => group.links.map((link) => link.label)),
  ).toContain("Créditos");
  expect(
    footerNavigation.flatMap((group) => group.links.map((link) => link.href)),
  ).toEqual(
    expect.arrayContaining([legalCopy.termsHref, legalCopy.privacyHref]),
  );

  const blob = JSON.stringify({
    facts,
    footerCopy,
    heroCopy,
    legalCopy,
    metadataCopy,
  });
  expect(blob).not.toMatch(/10–11/);
  expect(blob).not.toMatch(/10-11/);
  expect(blob).not.toMatch(/Terreno: Mapzen \/ USGS/);
});

test("publishes the confirmed prizes directly in soles", () => {
  expect(prizeAmountsUsd.first).toBe(2_000);
  expect(prizeAmountsUsd.second).toBe(500);
  expect(prizeAmountsPen.first).toBe(6_700);
  expect(prizeAmountsPen.second).toBe(1_675);
  expect(facts.find((fact) => fact.label === "Premios")?.value).toContain(
    "8,000",
  );
});

test("names the headquarters prize and its possible destinations", () => {
  expect(prizesCopy.tripTitle).toBe("Viaje a Chofex Headquarters");
  expect(prizesCopy.tripLocation).toBe(
    "(San Francisco, USA y/o Monterrey, Mexico)",
  );
  expect(prizesCopy.tripLines).toEqual(["Viaje a", "Chofex", "Headquarters"]);
  expect("tripLabel" in prizesCopy).toBe(false);
  expect("tripBody" in prizesCopy).toBe(false);

  const blob = JSON.stringify(prizesCopy);
  expect(blob).toMatch(/Monterrey/);
  expect(blob).toMatch(/San Francisco/);
  expect(blob).not.toMatch(/viajar/i);
});

test("publishes winner devtool prizes and participant credits separately", () => {
  expect(devtoolCreditsCopy.title).toBe("Créditos para equipos ganadores");
  expect(devtoolPartners).toHaveLength(2);

  const qatom = devtoolPartners.find((partner) => partner.id === "qatom");
  expect(qatom?.href).toBe("https://www.qatom.ai/hack-the-andes");
  expect(qatom?.participantBenefit).toEqual({
    duration: "6 meses",
    plan: "Plan Max",
    value: "Gratis · sin tarjeta para comenzar",
  });
  expect(qatom?.winnerPrizes).toEqual([
    {
      place: "1.er puesto",
      prize: "12 meses de Plan Max para el equipo",
      value: "$3,600 USD",
    },
    {
      place: "2.º y 3.er puesto",
      prize: "7 meses de Plan Max para el equipo",
      value: "$2,100 USD c/u",
    },
  ]);
  expect(qatom?.winnerNote).toBe(
    "Cada integrante de los equipos ganadores recibe además un voucher transferible de 12 meses de Plan Pro, valorado en $240 USD.",
  );

  const atomicMemory = devtoolPartners.find(
    (partner) => partner.id === "atomic-memory",
  );
  expect(atomicMemory?.participantBenefit).toEqual({
    duration: "5 meses",
    plan: "Plan Pro",
    value: "$19 USD/mes · $95 USD en total",
  });
  expect(atomicMemory?.winnerPrizes).toEqual([
    { place: "1.er puesto", prize: "1 año de Plan Max", value: "$1,188 USD" },
    {
      place: "2.º y 3.er puesto",
      prize: "1 año de Plan Pro",
      value: "$228 USD c/u",
    },
  ]);

  const zavu = participantDevtoolPartners.find(
    (partner) => partner.id === "zavu",
  );
  expect(participantDevtoolPartners).toHaveLength(3);
  expect(zavu?.participantBenefit).toEqual({
    duration: "3 meses",
    plan: "Plan Pro",
    value: "$20 USD/mes · $60 USD en total",
  });
  expect(devtoolPartners.map((partner) => partner.id)).not.toContain("zavu");

  expect(participantPerksCopy.title).toBe("Perks para participantes");
  expect(participantPerks.map((perk) => perk.title)).toEqual([
    "Comida y bebidas",
    "Energizantes",
    "Merch oficial",
    "Música y zonas de silencio",
    "Demo y tutorial de Qatom",
  ]);
  expect(participantPerks.at(-1)).toMatchObject({
    href: "https://luma.com/830d5l83",
    cta: "Registrarte en Luma",
  });
});

test("separates winner prizes from perks for every participant", async () => {
  const [prizesSource, perksSource] = await Promise.all([
    Bun.file(new URL("./prizes.tsx", import.meta.url)).text(),
    Bun.file(new URL("./participant-perks.tsx", import.meta.url)).text(),
  ]);

  expect(prizesSource).toContain("partner.winnerPrizes");
  expect(prizesSource).toContain("prizeAmountsPen.first");
  expect(prizesSource).toContain("prizeAmountsPen.second");
  expect(prizesSource).not.toContain("partner.participantBenefit");

  expect(perksSource).toContain("participantDevtoolPartners.map");
  expect(perksSource).toContain("partner.participantBenefit");
  expect(perksSource).toContain("participantPerks.map");
  expect(perksSource).not.toContain("partner.winnerPrizes");
});

test("aligns partner logos, prize rows, and the final participant perk", async () => {
  const [prizesSource, perksSource] = await Promise.all([
    Bun.file(new URL("./prizes.tsx", import.meta.url)).text(),
    Bun.file(new URL("./participant-perks.tsx", import.meta.url)).text(),
  ]);

  expect(perksSource).toContain("h-12 items-center");
  expect(perksSource).toContain("sm:last:col-span-2");
  expect(prizesSource).toContain("min-h-12 items-center");
  expect(prizesSource).toContain("sm:min-h-12");
  expect(prizesSource.indexOf("partner.winnerNote")).toBeGreaterThan(
    prizesSource.indexOf("devtoolPartners.map"),
  );
});

test("formats soles with the Peru locale", () => {
  expect(formatSoles(6_700)).toContain("6");
  expect(formatSoles(6_700)).toContain("700");
});

test("keeps the public pitch in Spanish and names Chofex as principal sponsor", () => {
  const blob = JSON.stringify({
    applyCopy,
    eventCopy,
    chromeCopy,
    footerCopy,
    heroCopy,
    legalCopy,
    peopleCopy,
    sectionNav,
    partners,
    sponsorsCopy,
  });
  expect(blob).not.toMatch(/nav unlocked/i);
  expect(blob).not.toMatch(/best of the best/i);
  expect(blob).not.toMatch(/window \/ facts/i);
  expect(blob).not.toMatch(/sponsored by/i);
  expect(blob).not.toMatch(/la élite/i);
  expect(sponsorsCopy.kicker).toBe("quiénes lo hacen");
  // Three partners, and the principal sponsor in the middle: the hero gives
  // the centre to Chofex and flanks it, so the order here is the layout.
  expect(partners.map((partner) => partner.id)).toEqual([
    "peru-tech-week",
    "chofex",
    "crafter-station",
  ]);
  // Every mark has to be white on transparent, or it arrives in a box.
  for (const partner of partners) {
    expect(partner.logoSrc).toMatch(/^\/sponsors\/[a-z-]+-white\.png$/);
    expect(partner.role.length).toBeGreaterThan(0);
  }
  expect(sponsorsCopy.mark).toBe("Chofex");
  // White for the dark page, black kept for light surfaces. Both transparent —
  // the mark is never to be boxed in a plate to make it legible.
  expect(sponsorsCopy.logoSrc).toBe("/sponsors/chofex-white.png");
  expect(sponsorsCopy.logoOnLightSrc).toBe("/sponsors/chofex-black.png");
  expect(partners.find((partner) => partner.id === "chofex")?.role).toBe(
    "Sponsor principal",
  );
  expect(
    partners.find((partner) => partner.id === "crafter-station")?.href,
  ).toBe("https://crafter.run");
  expect(footerCopy.meta).not.toMatch(/sponsor principal/i);
  expect(metadataCopy.description).not.toMatch(/sponsor principal/i);
  expect(heroCopy).not.toHaveProperty("sponsor");
});

test("frames the panel as top Peruvian talent and institutional backgrounds", () => {
  expect(peopleCopy.title).toBe("El talento más top de Perú");
  expect(peopleCopy.brandsLabel).toBe("Backgrounds");
  expect("kicker" in peopleCopy).toBe(false);
  expect("description" in peopleCopy).toBe(false);
  expect("lede" in peopleCopy).toBe(false);
  expect("status" in peopleCopy).toBe(false);

  const blob = JSON.stringify(peopleCopy);
  expect(blob).not.toMatch(/nombres por confirmar/i);
  expect(blob).not.toMatch(/sin nombres anunciados/i);
  expect(blob).not.toMatch(/instituciones/i);
  expect(blob).not.toMatch(/jueces, asesores y mentores/i);
  expect(blob).not.toMatch(/algunos de sus backgrounds/i);
  expect(blob).not.toMatch(/\b10\b/);
  expect(blob).not.toMatch(
    /Y Combinator|Stanford|University of Toronto|DP World|Hochschild|Palantir/i,
  );
  expect(panelBrands.map((brand) => brand.id)).toEqual([
    "mit",
    "yc",
    "google",
    "meta",
    "stanford",
    "microsoft",
    "harvard",
    "toronto",
    "dp-world",
    "hochschild",
    "palantir",
    "artificio",
  ]);
  expect(panelBrands.map((brand) => brand.name)).toEqual([
    "MIT",
    "YC",
    "Google",
    "Meta",
    "Stanford",
    "Microsoft",
    "Harvard",
    "University of Toronto",
    "DP World",
    "Hochschild",
    "Palantir",
    "Artificio",
  ]);
  expect(JSON.stringify(panelBrands)).not.toMatch(/Hoschild/);
  for (const brand of panelBrands) {
    expect(brand.logoSrc).toMatch(/^\/panel\/[a-z0-9-]+\.(png|svg)$/);
  }
});

test("keeps panel brand marks light on transparent for the black page", async () => {
  for (const brand of panelBrands) {
    const file = Bun.file(
      new URL(`../../public${brand.logoSrc}`, import.meta.url),
    );
    if (brand.logoSrc.endsWith(".svg")) {
      const source = await file.text();
      expect(source).toMatch(/fill="#f6f3ee"|fill="#ffffff"|fill="#fff"/i);
      expect(source).not.toMatch(/fill="#000"|fill="black"/i);
      continue;
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const tone = samplePngTone(bytes);
    expect(tone.whiteOpaque).toBeGreaterThan(0);
    expect(tone.blackOpaque).toBe(0);
  }
});

test("publishes a hundred-seat, three-track event", () => {
  expect(seatCount).toBe(100);
  expect(trackCount).toBe(3);
  expect(tracksCopy.title).toBe("3 Tracks centrales");
  expect(tracksCopy.subtitle).toBe("∞ Posibilidades de soluciones");
  expect(trackSeats).toHaveLength(3);
  expect(trackSeats.every((track) => track.hint.length > 0)).toBe(true);
  expect(qualifierChallengeCount).toBe(5);
  expect(tracksCopy.lede).toMatch(/día del evento/i);
  expect(tracksCopy.lede).toMatch(/elegir/i);
  expect(qualifierChallengesCopy.title).toBe("Gana tu pase en los challenges");
  expect(qualifierChallengesCopy.lede).toMatch(/antes del evento/i);
  expect(qualifierChallengesCopy.lede).toMatch(/cada semana/i);
  expect(qualifierChallengesCopy.lede).toMatch(/pase directo/i);
  expect(qualifierChallengesCopy.lede).toMatch(
    /registrarte no reserva un cupo/i,
  );
  expect(qualifierChallengesCopy.lede).toMatch(
    /todos deben enviar su postulación/i,
  );
  expect(heroCopy.admission).toMatch(/registrarte no reserva un cupo/i);
  expect(heroCopy.admission).toMatch(/envía tu postulación/i);
  expect(heroCopy.admission).toMatch(/challenge/i);
  expect(facts.find((fact) => fact.label === "Cupos")?.value).toBe("100");
  expect(metadataCopy.description).toContain("100 cupos");
  expect(eventCopy.title).toMatch(/grupo exclusivo de hackers/i);
  expect(eventCopy.title).toMatch(/Perú necesita/i);
  expect(eventCopy.lede).toMatch(/100/);
  expect(eventCopy.lede).toMatch(/problemas reales/i);
  expect(eventCopy.support).toMatch(/8,000/);
  expect(eventCopy.support).toMatch(/comida/i);
  expect(eventCopy.support).toMatch(/bebidas/i);
  expect(eventCopy.support).toMatch(/energizantes/i);
  expect(eventCopy.support).toMatch(/merch/i);
  expect(eventCopy.support).toMatch(/experiencia/i);
  expect(eventItems.map((item) => item.title)).toEqual([
    "Ship mata cartón",
    "Equipos de 1–4",
    "Work hard, Play Hard",
    "HardCore Mode",
  ]);
  const eventBlob = JSON.stringify({ eventCopy, eventItems });
  expect(eventBlob).toContain("17–18 de octubre");
  expect(eventBlob).toContain("Sede exacta por anunciar");
  expect(eventItems.filter((item) => /comida/i.test(item.body))).toHaveLength(
    1,
  );
});

test("answers application deadline, eligibility, and review questions", () => {
  expect(applyCopy.deadline).toBe("9 oct 2026");
  expect(applyCopy.lede).toMatch(/registrarte no reserva un cupo/i);
  expect(applyCopy.lede).toMatch(/construiste y shippeaste/i);
  expect(applyCopy.criteria.join(" ")).toMatch(/GitHub/i);
  expect(applyCopy.criteria.join(" ")).toMatch(/LinkedIn/i);

  const deadlineFaq = faqItems.find((item) =>
    /hasta cuándo puedo postular/i.test(item.question),
  );
  expect(deadlineFaq?.answer).toMatch(/9 de octubre de 2026/i);
  expect(deadlineFaq?.answer).toMatch(/cuanto antes/i);
  expect(deadlineFaq?.answer).toMatch(/cada semana/i);

  const experienceFaq = faqItems.find((item) =>
    /experiencia.*proyecto/i.test(item.question),
  );
  expect(experienceFaq?.answer).toMatch(/estudiando/i);
  expect(experienceFaq?.answer).toMatch(/años de experiencia/i);
  expect(experienceFaq?.answer).toMatch(/construir y shippear/i);

  const profileFaq = faqItems.find((item) => /perfil/i.test(item.question));
  expect(profileFaq?.answer).toMatch(/GitHub/i);
  expect(profileFaq?.answer).toMatch(/LinkedIn/i);
  expect(profileFaq?.answer).toMatch(/challenge/i);

  const selectionFaq = faqItems.find((item) =>
    /c[oó]mo se seleccionan/i.test(item.question),
  );
  expect(selectionFaq?.answer).toMatch(/postulaci[oó]n/i);
  expect(selectionFaq?.answer).toMatch(/pase directo/i);

  const registrationFaq = faqItems.find((item) =>
    /registrarme.*postular/i.test(item.question),
  );
  expect(registrationFaq?.answer).toMatch(/no/i);
  expect(registrationFaq?.answer).toMatch(/chofex register/i);
  expect(registrationFaq?.answer).toMatch(/challenge/i);
  expect(registrationFaq?.answer).toMatch(/primero envía tu postulación/i);

  expect(metadataCopy.description).not.toMatch(/con experiencia/i);
  expect(
    JSON.stringify({ applyCopy, eventItems, faqItems, metadataCopy }),
  ).not.toMatch(/lanz(?:a|an|ar|as|aste)/i);
});

test("invites participants to connect through Discord", async () => {
  expect(discordCopy.cta).toMatch(/Discord/i);
  expect(discordCopy.description).toMatch(/preséntate/i);
  expect(discordCopy.description).toMatch(/encuentra equipo/i);
  expect(discordCopy.description).toMatch(/preguntas/i);

  const [hero, faq] = await Promise.all([
    Bun.file(new URL("./hero.tsx", import.meta.url)).text(),
    Bun.file(new URL("./faq.tsx", import.meta.url)).text(),
  ]);
  expect(hero).toContain('href="/discord"');
  expect(faq).toContain('href="/discord"');
});

test("limits flight support to exceptional talent in other Peruvian cities", () => {
  expect(applyCopy.travelTitle).toMatch(/otra ciudad del Perú/i);
  expect(applyCopy.travelSupport).toMatch(/postula igual/i);
  expect(applyCopy.travelSupport).toMatch(/presupuesto limitado/i);
  expect(applyCopy.travelSupport).toMatch(/vuelos nacionales a Lima/i);
  expect(applyCopy.travelSupport).toMatch(/talento excepcional/i);
  expect(applyCopy.travelSupport).toMatch(/otras ciudades del Perú/i);
  expect(applyCopy.travelSupport).toMatch(/caso por caso/i);
  expect(applyCopy.travelSupport).toMatch(
    /no cubrimos vuelos internacionales/i,
  );

  const travelFaq = faqItems.find((item) =>
    /fuera de Lima/i.test(item.question),
  );
  expect(travelFaq?.answer).toMatch(/presupuesto limitado/i);
  expect(travelFaq?.answer).toMatch(/vuelos nacionales a Lima/i);
  expect(travelFaq?.answer).toMatch(/talento excepcional/i);
  expect(travelFaq?.answer).toMatch(/otras ciudades del Perú/i);
  expect(travelFaq?.answer).toMatch(/caso por caso/i);
  expect(travelFaq?.answer).toMatch(/no cubre vuelos internacionales/i);
});

test("ships one social preview card for every public link", async () => {
  // The card is a static file rather than an `ImageResponse`, so the guarantee
  // is that every name Next's file convention reads is actually on disk: drop
  // one and the routes it covers lose their preview without failing anything.
  for (const name of [
    "opengraph-image.jpg",
    "opengraph-image.alt.txt",
    "twitter-image.jpg",
    "twitter-image.alt.txt",
  ]) {
    const file = Bun.file(new URL(`../../app/${name}`, import.meta.url));
    expect(await file.exists()).toBe(true);
    expect(file.size).toBeGreaterThan(0);
  }

  // The phrasing rule outlived the lockup it was written for: the alt text is
  // now the only prose the card carries.
  const alt = await Bun.file(
    new URL("../../app/opengraph-image.alt.txt", import.meta.url),
  ).text();
  expect(alt).not.toMatch(/sponsor principal/i);
  expect(alt).toContain(brandName);
});

test("keeps the cash and trip lockup ahead of winner credits", async () => {
  const source = await Bun.file(
    new URL("./prizes.tsx", import.meta.url),
  ).text();
  expect(source).toContain("prizesCopy.tripTitle");
  expect(source).toContain("prizesCopy.tripLines");
  expect(source).toContain("prizesCopy.tripLocation");
  expect(source).toContain("minmax(0,1fr)");
  expect(source).toContain("landing-type-meta");
  expect(source.indexOf("prizePoolHeadlinePen")).toBeLessThan(
    source.indexOf("devtoolPartners.map"),
  );
  expect(source).not.toMatch(/text-\[10px\]/);
});

test("keeps the cash headline dominant without forcing one viewport", async () => {
  const source = await Bun.file(
    new URL("./prizes.tsx", import.meta.url),
  ).text();

  expect(source).not.toContain("min-h-svh");
  expect(source).not.toContain("md:justify-center");
  expect(source).toContain("py-10");
  expect(source).toContain("clamp(6rem,24vw,8.5rem)");
  expect(source).toContain("lg:text-[clamp(3.25rem,9vw,7.25rem)]");
});

test("labels track cards as tracks", async () => {
  const source = await Bun.file(
    new URL("./tracks.tsx", import.meta.url),
  ).text();
  expect(source).toContain("tracksCopy.subtitle");
  expect(source).toContain("Track {track.index}");
  expect(source).not.toContain("Challenge {seat.index}");
});

test("advertises Challenge 2 as live after Challenge 1 closes", async () => {
  const [homeSource, heroSource] = await Promise.all([
    Bun.file(new URL("../../app/page.tsx", import.meta.url)).text(),
    Bun.file(new URL("./hero.tsx", import.meta.url)).text(),
  ]);

  expect(homeSource).not.toContain("LiveChallengeBanner");
  expect(heroSource).toContain('href="/challenges/broken-agent"');
  expect(heroSource).toContain("heroCopy.challengeCta");
  expect(qualifierChallengesCopy.liveKicker).toMatch(/Challenge 2.*en vivo/i);
  expect(qualifierChallengesCopy.liveCta).toMatch(/competir/i);
});

test("exposes skip links and section jumps for keyboard users", async () => {
  expect(skipLinks[0]?.href).toBe("#contenido");
  expect(skipLinks[1]?.href).toBe("#apply");
  const hero = await Bun.file(new URL("./hero.tsx", import.meta.url)).text();
  const footer = await Bun.file(
    new URL("./footer.tsx", import.meta.url),
  ).text();
  expect(hero).toContain('href="#why"');
  expect(footer).toContain("footerNavigation");
  const footerSectionHrefs = footerNavigation
    .flatMap((group) => group.links.map((link) => link.href))
    .filter((href) => href.startsWith("#"))
    .sort();
  expect(footerSectionHrefs).toEqual(
    sectionNav.map((item) => item.href).sort(),
  );
  expect(sectionNav.map((item) => item.href)).toEqual([
    "#why",
    "#prizes",
    "#participant-perks",
    "#people",
    "#tracks",
    "#qualifier-challenges",
    "#apply",
    "#faq",
    "#sponsors",
  ]);
  expect(sectionNav.map((item) => item.label)).toEqual([
    "Evento",
    "Premios",
    "Perks",
    "Panel",
    "Tracks",
    "Challenges",
    "Postular",
    "FAQs",
    "Organizadores",
  ]);
});

function samplePngTone(bytes: Buffer): {
  whiteOpaque: number;
  blackOpaque: number;
} {
  if (bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a") {
    throw new Error("not a png");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idats: Buffer[] = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9] ?? 0;
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  if (colorType !== 6) {
    throw new Error(`unsupported png color type ${colorType}`);
  }

  const inflated = inflateSync(Buffer.concat(idats));
  const stride = width * 4;
  let src = 0;
  const prev = Buffer.alloc(stride);
  const row = Buffer.alloc(stride);
  let whiteOpaque = 0;
  let blackOpaque = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[src] ?? 0;
    src += 1;
    const raw = inflated.subarray(src, src + stride);
    src += stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= 4 ? (row[i - 4] ?? 0) : 0;
      const up = prev[i] ?? 0;
      const upLeft = i >= 4 ? (prev[i - 4] ?? 0) : 0;
      const x = raw[i] ?? 0;
      let value = x;
      if (filterType === 1) {
        value = (x + left) & 255;
      } else if (filterType === 2) {
        value = (x + up) & 255;
      } else if (filterType === 3) {
        value = (x + Math.floor((left + up) / 2)) & 255;
      } else if (filterType === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        let pr = upLeft;
        if (pa <= pb && pa <= pc) {
          pr = left;
        } else if (pb <= pc) {
          pr = up;
        }
        value = (x + pr) & 255;
      }
      row[i] = value;
    }

    for (let i = 0; i < stride; i += 4) {
      const r = row[i] ?? 0;
      const g = row[i + 1] ?? 0;
      const b = row[i + 2] ?? 0;
      const a = row[i + 3] ?? 0;
      if (a < 10) {
        continue;
      }
      if (r > 230 && g > 230 && b > 230) {
        whiteOpaque += 1;
      } else if (r < 25 && g < 25 && b < 25) {
        blackOpaque += 1;
      }
    }
    row.copy(prev);
  }

  return { whiteOpaque, blackOpaque };
}
