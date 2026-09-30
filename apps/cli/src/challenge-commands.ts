import {
  challengeBySlug,
  isChallengeClosedAt,
  isChallengeOpenAt,
} from "@chofex/challenges-contract";
import { Console, Effect, Option } from "effect";
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
import { execute, printJson } from "./output.js";

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
): string => {
  const lines: Array<string> = [challengeQuickstart.title];
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
    ...challengeQuickstart.story,
    "",
    "YOUR MISSION",
    challengeQuickstart.mission,
    "",
    "RULES OF THE GAME",
    ...challengeQuickstart.rules.map((rule) => `• ${rule}`),
    "",
    "FIELD GUIDE",
    "",
  );
  for (const item of challengeQuickstart.workflow) {
    lines.push(`${item.step}. ${item.action}`);
    lines.push(`   ${item.command}`);
    lines.push(`   ${item.note}`, "");
  }
  lines.push(`More detail: ${challengeQuickstart.helpCommand}`);
  return lines.join("\n");
};

const optionalString = (name: string, description: string) =>
  Flag.string(name).pipe(Flag.optional, Flag.withDescription(description));

const challengeFlag = Flag.string("challenge").pipe(
  Flag.withDefault(defaultChallengeSlug),
  Flag.withDescription("Challenge slug (default: broken-agent)"),
);

const sourceFlag = optionalString(
  "source",
  "JavaScript challenge solution file",
);

const reviewFlag = optionalString(
  "review",
  "Participant-authored Broken Agent engineering review JSON",
);

const officialEvaluateRetryCommand =
  "andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json";

const evaluationErrorText = (error: CliError): string | undefined => {
  if (error.code === "CHALLENGE_ENGINE_UNAVAILABLE") {
    return [
      "La evaluación oficial no se pudo completar.",
      "No es un error de tu computadora, y este intento no se consumió.",
      "",
      "Vuelve a ejecutar el mismo comando en unos segundos:",
      `  ${officialEvaluateRetryCommand}`,
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
      command: "andes challenge init --challenge broken-agent",
      description: "Usa explícitamente el slug del challenge",
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
    "Send one shipment to the undocumented oracle. A successful query consumes one limited request. Requires sign-in.",
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
      if (format === "csv") return notebookCsvText(attempt.observations);
      if (format === "json") {
        return JSON.stringify(attempt.observations, null, 2);
      }
      return notebookTableText(
        attempt.observations,
        Boolean(attempt.challenge.closed),
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
    yield* execute(options.output, operation, challengeTestText);
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
      return yield* evaluateChallenge(
        { apiUrl: options.apiUrl, token },
        challenge,
        solution,
      );
    });
    yield* execute(
      options.output,
      operation,
      challengeEvaluateText,
      evaluationErrorText,
    );
  }),
).pipe(
  Command.withDescription(
    "Score a solution on hidden cases. Broken Agent requires participant browser approval before a limited evaluation is consumed.",
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
    const participationState = participationStateFor(defaultChallengeSlug);
    const participationOpen = participationState === "open";
    const launchNotice = launchNoticeFor(defaultChallengeSlug);
    if (options.output === "json") {
      let workflow: ReadonlyArray<
        (typeof challengeQuickstart.workflow)[number]
      > = challengeQuickstart.workflow;
      let helpCommand: string = challengeQuickstart.helpCommand;
      let story: ReadonlyArray<string> = challengeQuickstart.story;
      let mission: string = challengeQuickstart.mission;
      let rules: ReadonlyArray<string> = challengeQuickstart.rules;
      if (participationState === "closed") {
        const rankingStep = challengeQuickstart.workflow.at(-1);
        workflow = rankingStep ? [rankingStep] : [];
        helpCommand = "andes challenge ranking --help";
        story = [];
        mission = "El Challenge 2 terminó. El ranking final sigue disponible.";
        rules = [];
      } else if (participationState === "scheduled") {
        workflow = [];
        helpCommand = "andes challenge list --help";
        story = [];
        mission = "El challenge todavía no está disponible.";
        rules = [];
      }
      const data: {
        readonly title: string;
        readonly story: typeof story;
        readonly mission: string;
        readonly rules: typeof rules;
        readonly workflow: typeof workflow;
        readonly helpCommand: string;
        readonly open: boolean;
        readonly state: ChallengeParticipationState;
        notice?: string;
      } = {
        ...challengeQuickstart,
        story,
        mission,
        rules,
        workflow,
        helpCommand,
        open: participationOpen,
        state: participationState,
      };
      if (launchNotice) data.notice = launchNotice;
      yield* printJson({
        version: 1,
        ok: true,
        requestId: crypto.randomUUID(),
        data,
      });
      return;
    }
    yield* Console.log(
      challengeQuickstartText(participationState, launchNotice),
    );
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
