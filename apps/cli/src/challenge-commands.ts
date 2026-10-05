import {
  challengeBySlug,
  isChallengeClosedAt,
  isChallengeOpenAt,
} from "@chofex/challenges-contract";
import {
  slowServiceChallengeVersion,
  slowServicePublicPerformance,
} from "@chofex/challenges-contract/slow-service";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import {
  evaluateChallenge,
  getChallengeAttempt,
  getChallengeRanking,
  listChallenges,
  queryChallenge,
  testChallenge,
} from "./api-client.js";
import {
  challengeEvaluationInput,
  defaultChallengeSlug,
  javascriptSourceFromPath,
  powerReadingInput,
  shipmentInput,
} from "./challenge-input.js";
import {
  challengeEvaluateText,
  challengeListText,
  challengeParticipationNotice,
  challengeQueryText,
  challengeRankingText,
  challengeShowText,
  challengeTestText,
  notebookCsvText,
  notebookTableText,
} from "./challenge-output.js";
import {
  type ChallengeScaffoldResult,
  createChallengeScaffold,
} from "./challenge-scaffold.js";
import { root } from "./cli-root.js";
import { type CliError, cliError } from "./errors.js";
import { execute } from "./output.js";
import {
  loadParticipantGuidance,
  type NextStep,
  nextStepText,
} from "./participant-guidance.js";

const challengeQuickstart = {
  title: "BROKEN AGENT — THE SCHEDULER",
  story: [
    "Un agente de código implementó un job scheduler y declaró la tarea terminada.",
    "Los siete tests públicos pasan, pero eso no demuestra que sea seguro bajo concurrencia, reinicios y fallas.",
  ],
  mission:
    "Audita scheduler.js, conserva createScheduler(dependencies) y haz que el sistema cumpla el contrato de producción.",
  rules: [
    "Los challenges son obligatorios: enviar la postulación no reserva un cupo.",
    "Los mejores resultados de los rankings serán seleccionados para el evento.",
    "Tienes 5 evaluaciones oficiales contra variantes ocultas y determinísticas por participante.",
    "Los tests locales y públicos son ilimitados.",
    "Gana el puntaje total; los empates usan menos evaluaciones y la hora del mejor envío.",
    "Las herramientas de AI están permitidas, pero el participante toma las decisiones de ingeniería.",
  ],
  workflow: [
    {
      step: 1,
      action: "Inicia sesión",
      command: "andes login",
      note: "Abre la autenticación de Clerk en tu navegador.",
    },
    {
      step: 2,
      action: "Crea el repositorio del challenge",
      command: "andes challenge init --challenge broken-agent",
      note: "Crea broken-agent/ con el contrato, el scheduler y siete tests públicos sin sobrescribir trabajo existente.",
    },
    {
      step: 3,
      action: "Confirma el punto de partida",
      command: "cd broken-agent && npm test",
      note: "Todo pasa. Ahora debes encontrar los riesgos que los happy paths no cubren.",
    },
    {
      step: 4,
      action: "Revisa tu presupuesto",
      command: "andes challenge show --challenge broken-agent",
      note: "Muestra las evaluaciones oficiales restantes y tu mejor puntaje.",
    },
    {
      step: 5,
      action: "Elige el riesgo con el participante",
      command: "Discute tres trazas de falla concretas",
      note: "El participante elige cuál investigar primero y explica qué resultado nunca debería ocurrir. El agente no puede decidirlo por su cuenta.",
    },
    {
      step: 6,
      action: "Audita y repara",
      command: "$EDITOR scheduler.js",
      note: "Convierte la traza elegida en evidencia reproducible y luego endurece claims, leases, reinicios, carreras, cancelación, reintentos e idempotencia.",
    },
    {
      step: 7,
      action: "Ejecuta los tests públicos",
      command:
        "andes challenge test --challenge broken-agent --source ./scheduler.js",
      note: "Es seguro repetirlos y no consumen evaluaciones oficiales.",
    },
    {
      step: 8,
      action: "Obtén el juicio del participante",
      command: "Crea review.json con sus propias palabras",
      note: "Debe describir una traza de falla, la evidencia revisada, ship o block, confianza y riesgo restante. Cambiar el código exige revisar de nuevo.",
    },
    {
      step: 9,
      action: "Crea el handoff de evaluación",
      command:
        "andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json",
      note: "Devuelve un enlace de aprobación sin consumir una evaluación oficial.",
    },
    {
      step: 10,
      action: "El participante aprueba en el navegador",
      command: "Abre approvalUrl personalmente",
      note: "Abre el enlace en su computadora y confirma con Windows Hello, Touch ID, PIN o llave de seguridad. Google Workspace puede bloquear las passkeys del teléfono. El agente no puede completar este paso.",
    },
    {
      step: 11,
      action: "Solicita el veredicto oculto",
      command:
        "andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json",
      note: "Repite el mismo comando antes de que venza la aprobación; recién entonces consume una evaluación.",
    },
    {
      step: 12,
      action: "Consulta el ranking",
      command: "andes challenge ranking --challenge broken-agent",
      note: "Se revela el 1 de octubre a las 15:00, hora de Perú.",
    },
  ],
  helpCommand: "andes challenge test --help",
} as const;

const slowServiceQuickstart = {
  title: "THE SLOW SERVICE",
  story: [
    "Un diario contable acepta correcciones solo si ninguna cuenta queda negativa en ningún momento. Sus saldos y percentiles históricos exactos nunca cambian.",
  ],
  mission:
    "Optimiza createLedger({ accounts }), amend() y report() sin cambiar ningún resultado.",
  rules: [
    "5 evaluaciones oficiales y tests públicos ilimitados.",
    "Revisiones optimistas, reemplazos completos y solvencia por grupos de timestamp. report({ account, from, to, asOf, percentile }) devuelve los cinco campos de saldo, debits y debitAmountAtPercentile.",
    "percentile es entero de 1 a 100. Usa ceil(debits * percentile / 100) sobre las magnitudes de legs negativas, con multiplicidad. El percentil 50 de [100, 300] es 100, no 200; el 100 es 300.",
    "Los créditos no cuentan. Débitos con importe o timestamp igual sí cuentan por separado. Sin débitos o en un intervalo vacío: debits = 0 y debitAmountAtPercentile = null. Rechazar una corrección no cambia la distribución.",
    "Trabaja con tu agente: puede implementar y probar. El participante elige un caso de falla, revisa evidencia real y aprueba el código exacto antes de evaluar. Puedes usar AI en la revisión; la aprobación registra responsabilidad, no comprensión ni autoría independiente.",
    `${slowServiceChallengeVersion} está disponible con revisión vinculada al código y aprobación en navegador.`,
    `La eficiencia compara ${slowServicePublicPerformance.smallJournalCount.toLocaleString("en-US")} y ${slowServicePublicPerformance.largeJournalCount.toLocaleString("en-US")} journals, N y 4N, con ${slowServicePublicPerformance.phaseOperations.toLocaleString("en-US")} operaciones posteriores. Crecimiento normalizado = crecimiento de tu CPU dividido por el de la referencia. Costo relativo = CPU de fase grande dividida por la referencia.`,
    ...slowServicePublicPerformance.tiers.map(
      (tier) =>
        `${tier.points} puntos por familia: crecimiento normalizado ≤ ${tier.normalizedGrowth} y costo relativo ≤ ${tier.relativeCpu}.`,
    ),
    "0 puntos si no cumple ningún nivel.",
    "La eficiencia también requiere reportes exactos con el historial máximo: 24,000 journals o entradas de ocho legs con 63,000 ediciones de débitos. Ambos casos alcanzan 72,000 ediciones de legs y pueden usar 1,024 cuentas con IDs de 64 unidades UTF-16. No agregan puntos ni grupos de correctitud. Si fallas por resultados, tiempo o memoria bajo los mismos límites de 640 MiB, 25 segundos de CPU y 30 de reloj para toda la ejecución, conservas solo los puntos de correctitud.",
    "Una respuesta incorrecta o ejecución incompleta en cualquier traza de rendimiento anula toda la eficiencia. Si pasaste los seis grupos exactos, conservas 60 puntos de correctitud.",
    "Un error del servidor o rechazo de inicialización no consume un intento oficial.",
    "Límites: 24,000 journals activos, 72,000 ediciones de legs aceptadas y heap del guest de 640 MiB. Retener checkpoints cuesta memoria; el benchmark debe mostrar la carga máxima y el pico de RSS del proceso Node, que no equivale al heap del guest.",
    "Los checkpoints de QuickJS solo son un límite de seguridad. No se exige un algoritmo específico.",
    "El ranking requiere una postulación enviada. No reserva un cupo.",
  ],
  workflow: [
    {
      step: 1,
      action: "Prepara el ledger",
      command: "andes challenge init --challenge make-it-fast",
      note: "Crea slow-service/ sin sobrescribir tu trabajo.",
    },
    {
      step: 2,
      action: "Lee el contrato y prueba",
      command:
        "cd slow-service && bun install && bun test ./.kit/ledger.test.ts",
      note: "Conserva .kit, package.json y bun.lock. El README define todos los inputs y resultados y el formato de review.json.",
    },
    {
      step: 3,
      action: "Optimiza y comprueba en QuickJS",
      command:
        "andes challenge test --challenge make-it-fast --source ./ledger.js",
      note: "No consume intentos. Los tests públicos no certifican rendimiento oculto.",
    },
    {
      step: 4,
      action: "Mide una carga reducida",
      command: "bun run benchmark ledger.js 1000",
      note: "Empieza reducido. Tamaño base de 1 a 6000; default 6000. Verifica respuestas y mide CPU de fase y RSS. memory, budget o timeout no son mediciones válidas de velocidad.",
    },
    {
      step: 5,
      action: "Mide el tamaño completo",
      command: "bun run benchmark ledger.js 6000",
      note: "Compara 6,000 y 24,000 journals con 1,024 operaciones posteriores. Usa montos variados. RSS incluye Node y WASM; no equivale al heap del guest.",
    },
    {
      step: 6,
      action: "Comprueba el historial máximo",
      command: "bun run benchmark ledger.js 6000 --max-history",
      note: "Requiere 6000 y alcanza 72,000 ediciones de legs aceptadas. Pasar tests pequeños no prueba que la historia quepa.",
    },
    {
      step: 7,
      action: "Comprueba el historial máximo de débitos",
      command:
        "bun run benchmark ledger.js 6000 --max-history --negative-heavy",
      note: "Requiere ambos flags y 6000. Diagnóstico de memoria con 2,000 y 8,000 journals de ocho legs, siete negativas, hasta 72,000 ediciones de legs y 63,000 ediciones de débitos. No cambia los tamaños oficiales de 6,000 y 24,000.",
    },
    {
      step: 8,
      action: "Evalúa oficialmente",
      command:
        "andes challenge evaluate --challenge make-it-fast --source ./ledger.js --review ./review.json",
      note: "Elige con tu agente un caso concreto y revisa sus resultados. Guarda review.json vinculado al SHA-256 del código. Abre personalmente approvalUrl, revisa el código exacto y aprueba con tu passkey. Repite el mismo comando antes de que venza. La espera no consume evaluaciones. block detiene el envío.",
    },
    {
      step: 9,
      action: "Consulta tu siguiente paso",
      command: "andes status",
      note: "Revisa también andes challenge ranking --challenge make-it-fast.",
    },
  ],
  helpCommand: "andes challenge test --help",
};
const powerGridQuickstart = {
  title: "POWER GRID / LA MÁQUINA DE FACTURACIÓN ELÉCTRICA",
  story: [
    "Una cooperativa perdió el código de su facturador. Solo conserva una máquina que recibe lecturas y devuelve céntimos.",
  ],
  mission: "Descubre las reglas y reemplázala con calculateBill(input).",
  rules: [
    "25 consultas, 3 evaluaciones y 1,000 lecturas ocultas.",
    "Los tests del cuaderno son gratuitos. Puedes usar AI.",
    "Cada lectura es independiente. Las tarifas son ficticias.",
  ],
  workflow: [
    {
      step: 1,
      action: "Prepara tu carpeta",
      command: "andes challenge init --challenge power-grid",
      note: "Luego entra con cd power-grid y lee README.md.",
    },
    {
      step: 2,
      action: "Consulta la máquina",
      command:
        "andes challenge query --challenge power-grid --input input.json",
      note: "Cambia una variable a la vez. Prueba cero, extremos e interacciones.",
    },
    {
      step: 3,
      action: "Consulta el cuaderno",
      command: "andes challenge notebook --challenge power-grid",
      note: "Los cinco campos son consumptionKwh, demandKw, hour, solar y business.",
    },
    {
      step: 4,
      action: "Prueba tu modelo",
      command: "andes challenge test --challenge power-grid --source bill.js",
      note: "Coincidir con el cuaderno no certifica el puntaje oculto.",
    },
    {
      step: 5,
      action: "Evalúa oficialmente",
      command:
        "andes challenge evaluate --challenge power-grid --source bill.js",
      note: "Consume un intento. El ranking conserva tu mejor puntaje.",
    },
  ],
  helpCommand: "andes challenge query --help",
};
type ChallengeQuickstart =
  | typeof powerGridQuickstart
  | typeof challengeQuickstart
  | typeof slowServiceQuickstart;

const launchNoticeFor = (slug: string): string | undefined => {
  const challenge = challengeBySlug(slug);
  if (!challenge) return undefined;
  return challengeParticipationNotice(
    challenge.theme,
    challenge.opensAt,
    challenge.closesAt,
  );
};

type ChallengeParticipationState = "scheduled" | "open" | "closed";

const participationStateFor = (slug: string): ChallengeParticipationState => {
  const challenge = challengeBySlug(slug);
  if (!challenge) return "scheduled";
  const now = new Date();
  if (isChallengeClosedAt(challenge, now)) return "closed";
  if (isChallengeOpenAt(challenge, now)) return "open";
  return "scheduled";
};

const challengeQuickstartText = (
  participationState: ChallengeParticipationState,
  launchNotice?: string,
  guide: ChallengeQuickstart = challengeQuickstart,
): string => {
  const lines: Array<string> = [guide.title];
  if (launchNotice) lines.push("", "LAUNCH NOTICE", launchNotice);
  if (participationState === "closed") {
    lines.push("", "RANKING FINAL", "  andes challenge ranking");
    return lines.join("\n");
  }
  if (participationState === "scheduled") {
    lines.push("", "PRÓXIMAMENTE", "  andes challenge list");
    return lines.join("\n");
  }
  lines.push(
    "",
    ...guide.story,
    "",
    "YOUR MISSION",
    guide.mission,
    "",
    "RULES OF THE GAME",
    ...guide.rules.map((rule) => `• ${rule}`),
    "",
    "FIELD GUIDE",
    "",
  );
  for (const item of guide.workflow) {
    lines.push(`${item.step}. ${item.action}`);
    lines.push(`   ${item.command}`);
    lines.push(`   ${item.note}`, "");
  }
  lines.push(`More detail: ${guide.helpCommand}`);
  return lines.join("\n");
};

const optionalString = (name: string, description: string) =>
  Flag.string(name).pipe(Flag.optional, Flag.withDescription(description));

const challengeFlag = Flag.string("challenge").pipe(
  Flag.withDefault(defaultChallengeSlug),
  Flag.withDescription(`Challenge slug (default: ${defaultChallengeSlug})`),
);

const sourceFlag = optionalString(
  "source",
  "JavaScript challenge solution file",
);

const reviewFlag = optionalString(
  "review",
  "Source-bound participant engineering review JSON for Broken Agent or The Slow Service",
);

const officialEvaluateRetryCommand =
  "andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json";

const evaluationErrorText = (
  error: CliError,
  challenge: string = defaultChallengeSlug,
): string | undefined => {
  if (error.code === "CHALLENGE_ENGINE_UNAVAILABLE") {
    let retryCommand = officialEvaluateRetryCommand;
    if (challenge === "make-it-fast")
      retryCommand =
        "andes challenge evaluate --challenge make-it-fast --source ./ledger.js";
    if (challenge === "power-grid")
      retryCommand =
        "andes challenge evaluate --challenge power-grid --source ./bill.js";
    if (challenge === "black-box")
      retryCommand =
        "andes challenge evaluate --challenge black-box --source ./shipping.js";
    return [
      "La evaluación oficial no se pudo completar.",
      "No es un error de tu computadora, y este intento no se consumió.",
      "",
      "Vuelve a ejecutar el mismo comando en unos segundos:",
      `  ${retryCommand}`,
    ].join("\n");
  }
  if (error.code !== "HUMAN_APPROVAL_REQUIRED") return undefined;
  if (!error.details || typeof error.details !== "object") return undefined;
  const details = error.details as Record<string, unknown>;
  if (typeof details.approvalUrl !== "string") return undefined;
  let retryCommand = officialEvaluateRetryCommand;
  if (typeof details.retryCommand === "string") {
    retryCommand = details.retryCommand;
  }
  const lines = [
    "INTERVENCIÓN DEL PARTICIPANTE REQUERIDA",
    "La evaluación todavía no consumió un intento.",
    "",
    "El participante debe abrir este enlace en su computadora, revisar sus respuestas y aprobar con Windows Hello, Touch ID, PIN o llave de seguridad. Google Workspace puede bloquear las passkeys del teléfono:",
    `  ${details.approvalUrl}`,
    "",
    "Después de aprobar, repite:",
    `  ${retryCommand}`,
  ];
  if (typeof details.expiresAt === "string") {
    lines.push("", `La aprobación vence: ${details.expiresAt}`);
  }
  return lines.join("\n");
};

const inputFlag = optionalString("input", "JSON file, or - for stdin");

const formatFlag = Flag.choice("format", ["table", "json", "csv"]).pipe(
  Flag.withDefault("table"),
  Flag.withDescription("Notebook format"),
);

const numberFromOption = (value: Option.Option<string>): number | undefined => {
  if (Option.isNone(value)) return undefined;
  return Number(value.value);
};

const booleanFromOption = (
  value: Option.Option<string>,
): boolean | undefined => {
  if (Option.isNone(value)) return undefined;
  if (value.value === "true") return true;
  if (value.value === "false") return false;
};

const challengeInitText = (result: ChallengeScaffoldResult): string => {
  if (result.challenge === "make-it-fast") {
    const message =
      result.status === "exists"
        ? `${result.path} ya existe. No se modificó.`
        : `Se creó ${result.path}. El starter es correcto, pero lento.`;
    return [
      message,
      "Lee README.md, optimiza ledger.js y ejecuta los tests públicos:",
      `  cd ${result.path} && bun install && bun test ./.kit/ledger.test.ts`,
      "  andes challenge test --challenge make-it-fast --source ./ledger.js",
    ].join("\n");
  }
  if (result.challenge === "broken-agent") {
    if (result.status === "exists") {
      return [
        `${result.path} ya existe. No se modificó.`,
        "",
        "Siguiente: continúa endureciendo el scheduler y ejecuta los tests públicos",
        `  cd ${result.path} && npm test`,
        "  andes challenge test --challenge broken-agent --source ./scheduler.js",
      ].join("\n");
    }
    return [
      `Se creó ${result.path}`,
      "El agente anterior dice que el scheduler está terminado. Todo pasa.",
      "Pero todavía no es seguro para producción.",
      "",
      "Empieza con el contrato normativo y los tests públicos:",
      `  cd ${result.path} && npm test`,
      "",
      "Luego repara scheduler.js y pruébalo sin consumir evaluaciones:",
      "  andes challenge test --challenge broken-agent --source ./scheduler.js",
    ].join("\n");
  }
  if (result.status === "exists") {
    return [
      `${result.path} already exists. Left it unchanged.`,
      "",
      "Next: keep investigating, then test your current solution",
      "  andes challenge query",
      `  andes challenge test --source ./${result.path}`,
    ].join("\n");
  }
  return [
    `Created ${result.path}`,
    "A documented baseline is ready for the rules you discover.",
    "",
    "Next: probe the machine",
    "  andes challenge query",
    "",
    `Then edit ${result.path} and test it safely:`,
    `  andes challenge test --source ./${result.path}`,
  ].join("\n");
};

const listCommand = Command.make(
  "list",
  {},
  Effect.fn("challengeListCommand")(function* () {
    const options = yield* root;
    yield* execute(
      options.output,
      listChallenges({ apiUrl: options.apiUrl }),
      challengeListText,
    );
  }),
).pipe(
  Command.withDescription(
    "Discover available challenges, opening dates, and scoring formats. No login required.",
  ),
  Command.withExamples([
    {
      command: "andes challenge list",
      description: "See which challenge is currently playable",
    },
  ]),
);

const initCommand = Command.make(
  "init",
  { challenge: challengeFlag },
  Effect.fn("challengeInitCommand")(function* ({ challenge }) {
    const options = yield* root;
    const participationState = participationStateFor(challenge);
    if (participationState !== "open") {
      const message =
        launchNoticeFor(challenge) ??
        "El challenge todavía no está disponible.";
      let code = "CHALLENGE_NOT_OPEN";
      if (participationState === "closed") code = "CHALLENGE_CLOSED";
      yield* execute(
        options.output,
        Effect.fail(cliError(code, message)),
        challengeInitText,
      );
      return;
    }
    const operation = createChallengeScaffold(challenge).pipe(
      Effect.map((data) => ({
        version: 1 as const,
        ok: true as const,
        requestId: crypto.randomUUID(),
        data,
      })),
    );
    yield* execute(options.output, operation, challengeInitText);
  }),
).pipe(
  Command.withDescription(
    "Crea el starter de un challenge sin sobrescribir trabajo existente.",
  ),
  Command.withExamples([
    {
      command: "andes challenge init --challenge broken-agent",
      description: "Prepara el repositorio de Broken Agent",
    },
    {
      command: "andes challenge init --challenge make-it-fast",
      description: "Prepara el ledger de The Slow Service",
    },
  ]),
);

const showCommand = Command.make(
  "show",
  { challenge: challengeFlag },
  Effect.fn("challengeShowCommand")(function* ({ challenge }) {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    yield* execute(
      options.output,
      getChallengeAttempt({ apiUrl: options.apiUrl, token }, challenge),
      challengeShowText,
    );
  }),
).pipe(
  Command.withDescription(
    "Consulta presupuesto, puntaje y progreso del challenge. Requiere iniciar sesión.",
  ),
  Command.withExamples([
    {
      command: "andes challenge show",
      description: "Revisa tu progreso antes de consumir intentos limitados",
    },
  ]),
);

const queryCommand = Command.make(
  "query",
  {
    challenge: challengeFlag,
    input: inputFlag,
    distance: optionalString("distance", "Shipment distance in whole km"),
    weight: optionalString("weight", "Shipment weight in whole kg"),
    hour: optionalString("hour", "Hour of day, 0-23"),
    fragile: Flag.choice("fragile", ["true", "false"]).pipe(
      Flag.optional,
      Flag.withDescription("Fragile surcharge flag"),
    ),
    express: Flag.choice("express", ["true", "false"]).pipe(
      Flag.optional,
      Flag.withDescription("Express surcharge flag"),
    ),
  },
  Effect.fn("challengeQueryCommand")(function* ({
    challenge,
    input,
    distance,
    weight,
    hour,
    fragile,
    express,
  }) {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    const operation = Effect.gen(function* () {
      if (challenge === "power-grid") {
        const reading = yield* powerReadingInput(Option.getOrUndefined(input));
        return yield* queryChallenge(
          { apiUrl: options.apiUrl, token },
          challenge,
          reading,
        );
      }
      const shipment = yield* shipmentInput(Option.getOrUndefined(input), {
        distanceKm: numberFromOption(distance),
        weightKg: numberFromOption(weight),
        hour: numberFromOption(hour),
        fragile: booleanFromOption(fragile),
        express: booleanFromOption(express),
      });
      return yield* queryChallenge(
        { apiUrl: options.apiUrl, token },
        challenge,
        shipment,
      );
    });
    yield* execute(options.output, operation, challengeQueryText);
  }),
).pipe(
  Command.withDescription(
    "Consulta el servicio sin documentación. Power Grid usa --input input.json. Una consulta exitosa consume una solicitud. Requiere iniciar sesión.",
  ),
  Command.withExamples([
    {
      command:
        "andes challenge query --challenge black-box --distance 10 --weight 3 --hour 14 --fragile false --express false",
      description: "Spend one oracle query",
    },
    {
      command:
        "andes challenge query --challenge black-box --input shipment.json",
      description: "Read the shipment fields from a JSON file",
    },
  ]),
);

const notebookCommand = Command.make(
  "notebook",
  { challenge: challengeFlag, format: formatFlag },
  Effect.fn("challengeNotebookCommand")(function* ({ challenge, format }) {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    const operation = getChallengeAttempt(
      { apiUrl: options.apiUrl, token },
      challenge,
    );
    yield* execute(options.output, operation, (attempt) => {
      if (format === "csv")
        return notebookCsvText(attempt.observations, attempt.challenge.slug);
      if (format === "json") {
        return JSON.stringify(attempt.observations, null, 2);
      }
      return notebookTableText(
        attempt.observations,
        Boolean(attempt.challenge.closed),
        attempt.challenge.slug,
      );
    });
  }),
).pipe(
  Command.withDescription(
    "Review every input and price you observed. Export table, JSON, or CSV for analysis. Requires sign-in.",
  ),
  Command.withExamples([
    {
      command: "andes challenge notebook --challenge black-box",
      description: "Read observations in a terminal table",
    },
    {
      command:
        "andes challenge notebook --challenge black-box --format csv > observations.csv",
      description: "Save observations for a spreadsheet",
    },
  ]),
);

const testCommand = Command.make(
  "test",
  { challenge: challengeFlag, source: sourceFlag },
  Effect.fn("challengeTestCommand")(function* ({ challenge, source }) {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    const operation = Effect.gen(function* () {
      const solution = yield* javascriptSourceFromPath(
        Option.getOrUndefined(source),
        challenge,
      );
      return yield* testChallenge(
        { apiUrl: options.apiUrl, token },
        challenge,
        solution,
      );
    });
    yield* execute(options.output, operation, (result) =>
      challengeTestText(result, challenge),
    );
  }),
).pipe(
  Command.withDescription(
    "Run the challenge's public tests. Safe to repeat; official evaluations are not consumed. Requires sign-in.",
  ),
  Command.withExamples([
    {
      command:
        "andes challenge test --challenge broken-agent --source ./scheduler.js",
      description: "Ejecuta los tests públicos de Broken Agent",
    },
  ]),
);

const evaluateCommand = Command.make(
  "evaluate",
  { challenge: challengeFlag, source: sourceFlag, review: reviewFlag },
  Effect.fn("challengeEvaluateCommand")(function* ({
    challenge,
    source,
    review,
  }) {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    const operation = Effect.gen(function* () {
      const solution = yield* challengeEvaluationInput(
        Option.getOrUndefined(source),
        Option.getOrUndefined(review),
        challenge,
      );
      const client = { apiUrl: options.apiUrl, token };
      const evaluated = yield* evaluateChallenge(client, challenge, solution);
      const nextStep = yield* loadParticipantGuidance(client).pipe(
        Effect.map((response) => response.data.nextStep),
        Effect.catch(() =>
          Effect.succeed({
            kind: "decision",
            message:
              "Tu evaluación oficial se guardó. Consulta el estado de tu postulación para continuar.",
            command: "andes status",
          } satisfies NextStep),
        ),
      );
      return { ...evaluated, data: { ...evaluated.data, nextStep } };
    });
    yield* execute(
      options.output,
      operation,
      (result) =>
        `${challengeEvaluateText(result)}\n\n${nextStepText(result.nextStep)}`,
      (error) => evaluationErrorText(error, challenge),
    );
  }),
).pipe(
  Command.withDescription(
    "Score a solution on hidden cases. Broken Agent and The Slow Service require participant browser approval before a limited evaluation is consumed.",
  ),
  Command.withExamples([
    {
      command:
        "andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json",
      description:
        "Consume una evaluación oficial cuando tu solución esté lista",
    },
  ]),
);

const rankingCommand = Command.make(
  "ranking",
  { challenge: challengeFlag },
  Effect.fn("challengeRankingCommand")(function* ({ challenge }) {
    const options = yield* root;
    yield* execute(
      options.output,
      getChallengeRanking({ apiUrl: options.apiUrl }, challenge),
      challengeRankingText,
    );
  }),
).pipe(
  Command.withDescription(
    "View the public leaderboard. No login required and no challenge budget consumed.",
  ),
  Command.withExamples([
    {
      command: "andes challenge ranking --challenge broken-agent",
      description: "Compara puntajes oficiales",
    },
  ]),
);

export const challengeCommand = Command.make(
  "challenge",
  {},
  Effect.fn("challengeQuickstartCommand")(function* () {
    const options = yield* root;
    const client = {
      apiUrl: options.apiUrl,
      token: Option.getOrUndefined(options.token),
    };
    const operation = loadParticipantGuidance(client).pipe(
      Effect.map((response) => {
        const { nextStep } = response.data;
        let guide: ChallengeQuickstart | undefined;
        if (
          (nextStep.kind === "challenge_start" ||
            nextStep.kind === "challenge_continue") &&
          nextStep.challengeSlug === "broken-agent"
        ) {
          guide = challengeQuickstart;
        }
        if (
          (nextStep.kind === "challenge_start" ||
            nextStep.kind === "challenge_continue") &&
          nextStep.challengeSlug === "make-it-fast"
        )
          guide = slowServiceQuickstart;
        if (
          (nextStep.kind === "challenge_start" ||
            nextStep.kind === "challenge_continue") &&
          nextStep.challengeSlug === "power-grid"
        )
          guide = powerGridQuickstart;
        return { ...response, data: { ...response.data, guide } };
      }),
    );
    yield* execute(options.output, operation, (result) => {
      if (!result.guide) return nextStepText(result.nextStep);
      return `${challengeQuickstartText("open", undefined, result.guide)}\n\n${nextStepText(result.nextStep)}`;
    });
  }),
).pipe(
  Command.withDescription(
    "Compite en challenges técnicos obligatorios por un cupo. Ejecuta el comando sin subcomandos para abrir la guía del challenge actual.",
  ),
  Command.withExamples([
    {
      command: "andes challenge",
      description: "Abre la guía de Broken Agent",
    },
    {
      command: "andes challenge init --challenge broken-agent",
      description: "Crea el repositorio de Broken Agent",
    },
    {
      command: "andes challenge test --help",
      description: "Revisa cómo ejecutar los tests públicos",
    },
  ]),
  Command.withSubcommands([
    listCommand,
    initCommand,
    showCommand,
    queryCommand,
    notebookCommand,
    testCommand,
    evaluateCommand,
    rankingCommand,
  ]),
);
