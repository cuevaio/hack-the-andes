/**
 * Landing copy and type rules.
 *
 * Casing:
 * - Brand lockup (header, hero, footer): title case "Hack the Andes"
 * - Section titles: display font + CSS uppercase
 * - Kickers: IBM Plex Mono, uppercase, wide tracking
 * - Body: sentence-case Spanish
 * - CLI commands and the agent prompt stay English
 *
 * Color roles: Sandy Linen paper, Aegean actions, Scarlet accent, ink type.
 */

export const prizeAmountsUsd = {
  first: 2_000,
  second: 500,
} as const;

export const prizeAmountsPen = {
  first: 6_700,
  second: 1_675,
} as const;

export const prizePoolHeadlinePen = 8_000;

const solesFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 0,
});

export const formatSoles = (amount: number): string =>
  solesFormatter.format(amount);

export const brandName = "Hack the Andes";

export const seatCount = 100;
export const trackCount = 3;
export const qualifierChallengeCount = 5;

export const metadataCopy = {
  title: `${brandName} — Lima, 17–18 oct 2026`,
  description: `100 cupos para AI, product y software engineers. Envía tu postulación y compite por un pase directo en los challenges. ${trackCount} tracks, 30 horas y una entrega funcionando.`,
} as const;

export const cliInstallMethods = [
  {
    id: "curl",
    label: "curl",
    description: "Recomendado · no requiere Node.js",
    hint: "Al terminar, sigue los pasos que muestra el instalador.",
    command: "curl -fsSL https://hacktheandes.com/install | bash",
  },
  {
    id: "npm",
    label: "npm",
    description: "Requiere Node.js 20 o superior",
    command: "npm install --global hacktheandes-cli@latest",
  },
] as const;

export const cliNextCommands = [
  "andes login",
  "andes register",
  "andes status",
] as const;

export const skipLinks = [
  { href: "#contenido", label: "Saltar al contenido" },
  { href: "#apply", label: "Saltar a aplicar" },
] as const;

/** Locked jump order: Evento → Premios → Perks → Panel → Tracks → Challenges → Postular → FAQs → Organizadores. */
export const sectionNav = [
  { href: "#why", label: "Evento" },
  { href: "#prizes", label: "Premios" },
  { href: "#participant-perks", label: "Perks" },
  { href: "#people", label: "Panel" },
  { href: "#tracks", label: "Tracks" },
  { href: "#qualifier-challenges", label: "Challenges" },
  { href: "#apply", label: "Postular" },
  { href: "#faq", label: "FAQs" },
  { href: "#sponsors", label: "Organizadores" },
] as const;

export const facts = [
  { label: "Cupos", value: String(seatCount) },
  { label: "Fecha", value: "17–18 oct 2026" },
  {
    label: "Premios",
    value: `Más de ${formatSoles(prizePoolHeadlinePen)}`,
  },
  { label: "Equipos", value: "1–4 personas" },
] as const;

export const heroCopy = {
  titleLead: "Hack the",
  titleAccent: "Andes",
  metaDate: "17–18 oct 2026",
  metaLocation: "Lima, Perú",
  cta: "Postular",
  challengeCta: "Ver challenges",
  admission:
    "Registrarte no reserva un cupo. Envía tu postulación para poder ser aceptado; los mejores resultados en los challenges ganan pase directo.",
  organizer: "Organiza: Crafter Station",
  skipToWhy: "Conocer el evento",
} as const;

export const discordCopy = {
  cta: "Únete al Discord",
  title: "Conecta con la comunidad",
  description:
    "Preséntate, conoce a otros participantes, encuentra equipo y haz tus preguntas antes del evento.",
} as const;

export const eventCopy = {
  title: "Un grupo exclusivo de hackers construyendo lo que el Perú necesita",
  lede: "Únete a 100 personas que construyen y shippean para resolver problemas reales del país, no solo lo que está trending.",
  support: `Más de ${formatSoles(prizePoolHeadlinePen)} en premios, comida, bebidas, energizantes, merch y 30 horas de una experiencia diseñada para hacer tu mejor trabajo.`,
} as const;

export const eventItems = [
  {
    title: "Ship mata cartón",
    body: "Construyes y shippeas. El filtro es lo que ya pusiste en producción.",
  },
  {
    title: "Equipos de 1–4",
    body: "Puedes postular con equipo, buscar uno al ser aceptado o construir solo.",
  },
  {
    title: "Work hard, Play Hard",
    body: "100 personas, 30 horas, un mismo espacio. Comida, bebidas, energizantes, merch, música y zonas de silencio.",
  },
  {
    title: "HardCore Mode",
    body: "30 horas con entrega real. Presencial en Lima, 17–18 de octubre. Sede exacta por anunciar.",
  },
] as const;

export const tracksCopy = {
  title: `${trackCount} Tracks centrales`,
  subtitle: "∞ Posibilidades de soluciones",
  lede: `Los tracks son los temas de trabajo del día del evento. Las personas aceptadas conocerán los ${trackCount} briefs en Lima, elegirán en cuál quieren trabajar y tendrán 30 horas para entregar un producto funcionando.`,
  reveal: "Se revela en Lima, 17 oct",
} as const;

export const trackSeats = [
  {
    index: "01",
    hint: "Una señal cambia. Tu sistema tiene que entenderla y responder.",
  },
  {
    index: "02",
    hint: "Hay nodos que todavía no se encuentran. Construye el puente.",
  },
  {
    index: "03",
    hint: "La interfaz es parte del problema. El producto también es la respuesta.",
  },
] as const;

export const qualifierChallengesCopy = {
  title: "Gana tu pase en los challenges",
  subtitle: "Postula y compite",
  lede: `Registrarte no reserva un cupo: todos deben enviar su postulación para poder ser aceptados. Con la postulación enviada, queda entre los mejores en uno de los ${qualifierChallengeCount} challenges y gana un pase directo. Son pruebas técnicas individuales antes del evento y publicaremos una nueva cada semana.`,
  tracksLabel: "Tracks / durante el evento",
  tracksBody: `Son ${trackCount} temas para construir en equipo durante 30 horas. Los eliges presencialmente en Lima.`,
  challengesLabel: "Challenges / antes del evento",
  challengesBody: `Resuelve una de las ${qualifierChallengeCount} pruebas, sube al ranking y compite por un pase directo al evento.`,
  liveKicker: "Challenge 2 / en vivo",
  liveTitle: "The Scheduler",
  liveBody:
    "Un agente dice que terminó un job scheduler. Todos los tests pasan. Haz que realmente esté listo para producción.",
  liveMeta: "7 tests verdes · 5 evaluaciones oficiales · AI permitida",
  liveCta: "Competir por un pase →",
} as const;

export const peopleCopy = {
  title: "El talento más top de Perú",
  brandsLabel: "Backgrounds",
} as const;

/**
 * Institutional marks for the panel chapter.
 *
 * These are backgrounds, not a confirmed roster. Names and roles stay off the
 * page until each participation is verified. Order is locked: MIT, YC, Google,
 * Meta, Stanford, Microsoft, Harvard, U of Toronto, DP World, Hochschild,
 * Palantir, Artificio.
 */
export const panelBrands = [
  {
    id: "mit",
    name: "MIT",
    shape: "wordmark",
    logoSrc: "/panel/mit.png",
    logoWidth: 120,
    logoHeight: 36,
  },
  {
    id: "yc",
    name: "YC",
    shape: "square",
    logoSrc: "/panel/yc.png",
    logoWidth: 40,
    logoHeight: 40,
  },
  {
    id: "google",
    name: "Google",
    shape: "square",
    logoSrc: "/panel/google.png",
    logoWidth: 40,
    logoHeight: 40,
  },
  {
    id: "meta",
    name: "Meta",
    shape: "wordmark",
    logoSrc: "/panel/meta.png",
    logoWidth: 86,
    logoHeight: 32,
  },
  {
    id: "stanford",
    name: "Stanford",
    shape: "wordmark",
    logoSrc: "/panel/stanford.png",
    logoWidth: 168,
    logoHeight: 36,
  },
  {
    id: "microsoft",
    name: "Microsoft",
    shape: "square",
    logoSrc: "/panel/microsoft.png",
    logoWidth: 40,
    logoHeight: 40,
  },
  {
    id: "harvard",
    name: "Harvard",
    shape: "square",
    logoSrc: "/panel/harvard.png",
    logoWidth: 36,
    logoHeight: 40,
  },
  {
    id: "toronto",
    name: "University of Toronto",
    shape: "wordmark",
    logoSrc: "/panel/toronto.png",
    logoWidth: 720,
    logoHeight: 180,
  },
  {
    id: "dp-world",
    name: "DP World",
    shape: "wordmark",
    logoSrc: "/panel/dp-world.png",
    logoWidth: 156,
    logoHeight: 36,
  },
  {
    id: "hochschild",
    name: "Hochschild",
    shape: "wordmark",
    logoSrc: "/panel/hochschild.png",
    logoWidth: 188,
    logoHeight: 36,
  },
  {
    id: "palantir",
    name: "Palantir",
    shape: "wordmark",
    logoSrc: "/panel/palantir.png",
    logoWidth: 156,
    logoHeight: 36,
  },
  {
    id: "artificio",
    name: "Artificio",
    shape: "wordmark",
    logoSrc: "/panel/artificio.png",
    logoWidth: 156,
    logoHeight: 58,
  },
] as const;

export const applyCopy = {
  title: "Postula desde tu terminal",
  lede: "Registrarte no reserva un cupo. Envía tu postulación hasta el 9 de octubre de 2026 y cuéntanos qué construiste y shippeaste. Luego compite en los challenges: los mejores resultados ganan pase directo.",
  deadlineLabel: "Cierre de postulaciones",
  deadline: "9 oct 2026",
  travelTitle: "¿Vives en otra ciudad del Perú?",
  travelSupport:
    "Postula igual. Tenemos un presupuesto limitado para cubrir vuelos nacionales a Lima de participantes con talento excepcional que viven en otras ciudades del Perú. Evaluamos el apoyo caso por caso; no cubrimos vuelos internacionales.",
  criteriaTitle: "Qué revisamos",
  criteria: [
    "Evidencia en tu GitHub, LinkedIn o productos publicados de que construyes y shippeas.",
    "La claridad con la que explicas decisiones y tradeoffs.",
    "La ambición y viabilidad de lo que quieres construir.",
    "Tu resultado en un challenge; los mejores de cada uno obtienen pase directo.",
  ],
  cliTitle: "Ruta directa",
  agentKicker: "agent",
  agentTitle: "Ruta asistida",
} as const;

export const prizesCopy = {
  title: "Premios para ganadores",
  lede: "Premios en efectivo para las soluciones que mejor conviertan un problema real en un producto funcionando.",
  totalSuffix: "en premios en efectivo",
  tripTitle: "Viaje a Chofex Headquarters",
  tripLocation: "(San Francisco, USA y/o Monterrey, Mexico)",
  /*
   * Stacked so "Viaje a" is the trip, and CHOFEX / HEADQUARTERS stay a
   * readable lockup on a ~390px phone — not a 12px afterthought.
   */
  tripLines: ["Viaje a", "Chofex", "Headquarters"],
} as const;

export const devtoolCreditsCopy = {
  title: "Créditos para equipos ganadores",
  lede: "Planes premium de Qatom y AtomicMemory para seguir construyendo después del hackathon.",
} as const;

export const participantPerksCopy = {
  title: "Perks para participantes",
  lede: "Todo lo que recibes por participar: herramientas premium para construir y una experiencia diseñada para mantenerte enfocado durante las 30 horas.",
  creditsTitle: "Créditos al registrarte",
  creditsNote: "Disponibles para todos los participantes.",
} as const;

export const participantPerks = [
  {
    title: "Comida y bebidas",
    body: "Comida y bebidas durante las 30 horas para que puedas seguir construyendo.",
    href: null,
    cta: null,
  },
  {
    title: "Energizantes",
    body: "Energy drinks para acompañarte durante el hackathon.",
    href: null,
    cta: null,
  },
  {
    title: "Merch oficial",
    body: "Merch de Hack the Andes para cada participante.",
    href: null,
    cta: null,
  },
  {
    title: "Música y zonas de silencio",
    body: "Espacios con distintos ritmos para colaborar, concentrarte o descansar.",
    href: null,
    cta: null,
  },
  {
    title: "Demo y tutorial de Qatom",
    body: "Sesión en vivo de 90 minutos con Hassan Khan, CEO de Qatom. Viernes 2 de octubre a las 6:30 p. m. ET, por Zoom.",
    href: "https://luma.com/830d5l83",
    cta: "Registrarte en Luma",
  },
] as const;

export const devtoolPartners = [
  {
    id: "qatom",
    name: "Qatom",
    href: "https://www.qatom.ai/hack-the-andes",
    logoSrc: "/devtools/qatom.png",
    logoWidth: 620,
    logoHeight: 154,
    logoClassName: "h-10",
    participantBenefit: {
      duration: "6 meses",
      plan: "Plan Max",
      value: "Gratis · sin tarjeta para comenzar",
    },
    winnerPrizes: [
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
    ],
    winnerNote:
      "Cada integrante de los equipos ganadores recibe además un voucher transferible de 12 meses de Plan Pro, valorado en $240 USD.",
  },
  {
    id: "atomic-memory",
    name: "AtomicMemory Cloud",
    href: "https://memory.atomicstrata.ai/",
    logoSrc: "/devtools/atomic-memory.svg",
    logoWidth: 1280,
    logoHeight: 185.34,
    logoClassName: "h-8",
    participantBenefit: {
      duration: "5 meses",
      plan: "Plan Pro",
      value: "$19 USD/mes · $95 USD en total",
    },
    winnerPrizes: [
      {
        place: "1.er puesto",
        prize: "1 año de Plan Max",
        value: "$1,188 USD",
      },
      {
        place: "2.º y 3.er puesto",
        prize: "1 año de Plan Pro",
        value: "$228 USD c/u",
      },
    ],
    winnerNote: null,
  },
] as const;

export const participantDevtoolPartners = [
  ...devtoolPartners,
  {
    id: "zavu",
    name: "Zavu",
    href: "https://www.zavu.dev/",
    logoSrc: "/devtools/zavu.svg",
    logoWidth: 144,
    logoHeight: 40,
    logoClassName: "h-10",
    participantBenefit: {
      duration: "3 meses",
      plan: "Plan Pro",
      value: "$20 USD/mes · $60 USD en total",
    },
  },
] as const;

export const sponsorsCopy = {
  kicker: "quiénes lo hacen",
  title: "Chofex",
  lede: "Hack the Andes se realiza con el respaldo de Chofex, la producción de Crafter Station y el apoyo de Peru Tech Week.",
  organizer: "Organiza: Crafter Station",
  mark: "Chofex",
  /*
   * Chofex's two official marks, both on transparent.
   *
   * There is no single "the logo": there is one for dark surfaces and one for
   * light, and picking the wrong one is what forced the old lockup to sit in a
   * cream plate on a black page. The landing is black, so `logoSrc` is the
   * white mark; the black one is here for anywhere that goes back to paper.
   */
  logoSrc: "/sponsors/chofex-white.png",
  logoOnLightSrc: "/sponsors/chofex-black.png",
  logoWidth: 1200,
  logoHeight: 295,
} as const;

/**
 * Who is behind the event, in reading order.
 *
 * Chofex sits in the middle because it is the principal sponsor and the hero
 * gives it the centre; the other two flank it. `role` is not decoration — the
 * hero shows these as logos alone, so it is what carries "which one of these
 * is paying for it and which one is running it" to anyone who cannot see the
 * marks, and it goes into the alt text there.
 *
 * Every mark is white on transparent. A sponsor's logo in a box, or inverted
 * into a colour it does not come in, is the thing their brand guide exists to
 * prevent.
 *
 * `shape` is what lets them be set at one optical size. Two of these are
 * wordmarks four or five times wider than they are tall; Peru Tech Week's is a
 * square lockup stacking three words. Matched on height the square one comes
 * out with type a third the size of the others and unreadable, and matched on
 * width it towers over both — so the stacked one is given its own height.
 */
export const partners = [
  {
    id: "peru-tech-week",
    name: "Peru Tech Week",
    role: "Aliado",
    shape: "stacked",
    href: "https://perutechweek.com",
    logoSrc: "/sponsors/peru-tech-week-white.png",
    logoWidth: 730,
    logoHeight: 600,
  },
  {
    id: "chofex",
    name: "Chofex",
    role: "Sponsor principal",
    shape: "wordmark",
    href: "https://chofex.com",
    logoSrc: "/sponsors/chofex-white.png",
    logoWidth: 1200,
    logoHeight: 295,
  },
  {
    id: "crafter-station",
    name: "Crafter Station",
    role: "Organiza",
    shape: "wordmark",
    href: "https://crafter.run",
    logoSrc: "/sponsors/crafter-station-white.png",
    logoWidth: 1200,
    logoHeight: 233,
  },
] as const;

export const faqCopy = {
  title: "Preguntas frecuentes",
} as const;

export const faqItems = [
  {
    question: "¿Registrarme ya cuenta como postular?",
    answer:
      "No. Registrarte o iniciar sesión solo crea tu cuenta. Para poder ser aceptado, primero envía tu postulación con andes register. Luego participa en un challenge: los mejores resultados obtienen pase directo.",
  },
  {
    question: "¿Necesito experiencia previa o un tipo de proyecto específico?",
    answer:
      "No. Puedes estar estudiando o tener años de experiencia, y no exigimos un sector o tipo de proyecto específico. Buscamos reunir a los mejores engineers de Perú: personas que puedan demostrar que saben construir y shippear.",
  },
  {
    question: "¿Hasta cuándo puedo postular?",
    answer:
      "Las postulaciones cierran el 9 de octubre de 2026, pero recomendamos enviar la tuya cuanto antes y estar atento a los challenges. Publicaremos uno cada semana y los mejores resultados de cada challenge obtienen pase directo al evento.",
  },
  {
    question: "¿Qué revisarán de mi perfil?",
    answer:
      "Revisaremos tu GitHub y LinkedIn para encontrar evidencia concreta de que construyes y shippeas: productos en uso, repositorios activos, demos, contribuciones o experiencia con resultados. Tu entrega en un challenge suma evidencia, y los mejores resultados obtienen pase directo.",
  },
  {
    question: "¿Necesito un equipo?",
    answer:
      "No. Los equipos pueden tener de 1 a 4 personas y podrás conectar con otros participantes aceptados.",
  },
  {
    question: "¿Puedo postular si vivo fuera de Lima?",
    answer:
      "Sí. Tenemos un presupuesto limitado para cubrir vuelos nacionales a Lima de participantes con talento excepcional que viven en otras ciudades del Perú. Este apoyo se evalúa caso por caso y no cubre vuelos internacionales.",
  },
  {
    question: "¿Cuándo se revelan los tracks?",
    answer: `Al iniciar la hackathon, el 17 de octubre. Las personas aceptadas conocerán los ${trackCount} briefs y elegirán presencialmente en cuál quieren trabajar.`,
  },
  {
    question: "¿Cuál es la diferencia entre tracks y challenges?",
    answer:
      "Los tracks son los temas de trabajo que eliges durante la hackathon. Los challenges son pruebas técnicas previas para quienes ya enviaron su postulación: los mejores resultados de cada uno obtienen pase directo al evento.",
  },
  {
    question: "¿Cómo se seleccionan los 100 cupos?",
    answer:
      "Todos empiezan enviando su postulación. Revisamos lo que ya construiste, tu criterio al explicarlo y la propuesta que llevarías; además, los mejores resultados de cada challenge obtienen pase directo.",
  },
] as const;

export const footerCopy = {
  meta: "Lima, 17–18 oct 2026",
  tagline: "100 personas, 30 horas, una entrega funcionando.",
  navigationLabel: "Pie de página",
  applicationStatus: "Postulaciones abiertas",
  applicationDeadline: "Hasta el 9 oct",
  copyright: "© 2026 Hack the Andes",
  organizer: "Organiza Crafter Station",
} as const;

export const legalNavigation = [
  { href: "/terms", label: "Términos" },
  { href: "/privacy", label: "Privacidad" },
] as const;

export const footerNavigation = [
  {
    label: "Evento",
    links: [
      { href: "#why", label: "El evento" },
      { href: "#prizes", label: "Premios" },
      { href: "#participant-perks", label: "Perks" },
      { href: "#people", label: "Panel" },
    ],
  },
  {
    label: "Programa",
    links: [
      { href: "#tracks", label: "Tracks" },
      { href: "#qualifier-challenges", label: "Challenges" },
      { href: "#faq", label: "Preguntas frecuentes" },
    ],
  },
  {
    label: "Participa",
    links: [
      { href: "#apply", label: "Postular" },
      { href: "/discord", label: "Discord" },
    ],
  },
  {
    label: "Información",
    links: [
      { href: "#sponsors", label: "Organizadores" },
      { href: "/credits", label: "Créditos" },
      ...legalNavigation,
    ],
  },
] as const;

export const chromeCopy = {
  menu: "Menú",
  close: "Cerrar",
  sections: "Secciones",
  apply: "Aplicar",
} as const;

export const legalCopy = {
  home: "Inicio",
  navigationLabel: "Páginas legales",
  eventKicker: "Lima presencial · 17–18 oct 2026",
  termsHref: legalNavigation[0].href,
  privacyHref: legalNavigation[1].href,
  termsTitle: "Términos y Condiciones",
  privacyTitle: "Privacidad",
  termsDescription: `Términos y condiciones de participación para ${brandName}, evento presencial en Lima el 17 y 18 de octubre de 2026.`,
  privacyDescription: `Política de privacidad de ${brandName} para la postulación y el evento presencial en Lima, 17–18 de octubre de 2026.`,
} as const;
