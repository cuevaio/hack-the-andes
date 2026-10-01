import {
  CountryCode,
  countryTravelNotice,
  joinFullName,
} from "@chofex/registration-contract";
import { Console, Effect, Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import {
  confirmAttendance,
  getBadge,
  getCurrentUser,
  getRegistration,
  regenerateBadge,
  register,
  selectRegistrationCountry,
} from "./api-client.js";
import { login as oauthLogin, logout as oauthLogout } from "./auth.js";
import { challengeCommand } from "./challenge-commands.js";
import { registrationPartsText } from "./challenge-output.js";
import { root } from "./cli-root.js";
import { config } from "./config.js";
import { cliError } from "./errors.js";
import {
  acceptedDetailsInput,
  applicationDefaultsFromRegistration,
  applicationInput,
  badgeProfileInput,
  picturePathInput,
  selectCountry,
} from "./input.js";
import {
  badgeText,
  createdText,
  execute,
  printJson,
  registrationLookupErrorText,
  registrationText,
  requirementsOnlyText,
} from "./output.js";
import {
  loadParticipantGuidance,
  type NextStep,
  nextStepFor,
  nextStepText,
  withRegistrationNextStep,
} from "./participant-guidance.js";
import { uploadPicture } from "./picture-upload.js";
import {
  cliPackageName,
  skillName,
  updateChofex,
  upgradeVersion,
} from "./upgrade.js";
import { renderWelcome } from "./welcome.js";

type InputStage = "application" | "acceptance";

const inputFlag = Flag.string("input").pipe(
  Flag.optional,
  Flag.withDescription("Read JSON from a file, or use - for stdin"),
);

const stageFlag = Flag.choice("stage", ["application", "acceptance"]).pipe(
  Flag.withDefault("application"),
);

const currentRegistration = (client: {
  readonly apiUrl: string;
  readonly token?: string;
}) =>
  getRegistration(client).pipe(
    Effect.map(Option.some),
    Effect.catch((error) => {
      if (error.code === "REGISTRATION_NOT_FOUND") {
        return Effect.succeed(Option.none());
      }
      return Effect.fail(error);
    }),
  );

const registerCommand = Command.make(
  "register",
  { input: inputFlag },
  Effect.fn("registerCommand")(function* ({ input }) {
    const options = yield* root;
    let existing = false;
    const operation = Effect.gen(function* () {
      const token = Option.getOrUndefined(options.token);
      const client = { apiUrl: options.apiUrl, token };
      const current = yield* currentRegistration(client);
      if (
        Option.isSome(current) &&
        !current.value.data.requirements.canSubmitNewApplication &&
        !current.value.data.requirements.canSaveDraft
      ) {
        existing = true;
        return current.value;
      }

      if (Option.isSome(input)) {
        const body = yield* applicationInput(input.value, config.publicSiteUrl);
        yield* Effect.sync(() =>
          process.stderr.write(`${countryTravelNotice(body.countryCode)}\n`),
        );
        return yield* register(client, body);
      }

      if (
        options.output === "json" ||
        !process.stdin.isTTY ||
        !process.stdout.isTTY
      ) {
        return yield* cliError(
          "INPUT_REQUIRED",
          "Non-interactive use requires --input <file>, or --input - for stdin",
        );
      }

      return yield* interactiveRegister(client, current);
    });
    yield* execute(
      options.output,
      withRegistrationNextStep(operation),
      (result) => {
        if (existing)
          return `Tu postulación ya estaba enviada.\n${registrationText(result)}`;
        return createdText(result);
      },
      registrationLookupErrorText,
    );
  }),
).pipe(
  Command.withDescription("Complete and submit an application for review"),
  Command.withExamples([
    {
      command: "andes register",
      description: "Fill or resume the application interactively",
    },
    {
      command: "andes --output json register --input application.json",
      description: "Submit an application from an agent or script",
    },
  ]),
);

const interactiveRegister = (
  client: { readonly apiUrl: string; readonly token?: string },
  initial: Option.Option<{
    data: import("@chofex/registration-contract").RegistrationResult;
  }>,
) =>
  Effect.gen(function* () {
    const latest = Option.isSome(initial) ? initial.value.data : undefined;
    if (latest) {
      yield* Console.log(registrationPartsText(latest));
    } else {
      yield* Console.log(
        "No application yet. Your application will be submitted after you finish.",
      );
    }
    let defaults = {};
    if (latest) {
      defaults = applicationDefaultsFromRegistration(latest.registration);
    }
    const body = yield* applicationInput(
      undefined,
      config.publicSiteUrl,
      defaults,
    );
    return yield* register(client, body);
  });

const statusCommand = Command.make(
  "status",
  {},
  Effect.fn("statusCommand")(function* () {
    const options = yield* root;
    const operation = Effect.gen(function* () {
      const token = Option.getOrUndefined(options.token);
      return yield* getRegistration({ apiUrl: options.apiUrl, token });
    });
    yield* execute(
      options.output,
      withRegistrationNextStep(operation),
      registrationText,
      registrationLookupErrorText,
    );
  }),
).pipe(Command.withDescription("Show your latest application and next steps"));

const countryCommand = Command.make(
  "country",
  { code: Flag.string("code").pipe(Flag.optional) },
  Effect.fn("countryCommand")(function* ({ code }) {
    const options = yield* root;
    const operation = Effect.gen(function* () {
      const client = {
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      };
      const current = yield* getRegistration(client);
      let countryCode: string;
      if (Option.isSome(code)) {
        countryCode = yield* Schema.decodeUnknownEffect(CountryCode)(
          code.value,
        ).pipe(
          Effect.mapError(() =>
            cliError(
              "VALIDATION_ERROR",
              "Usa un código de país ISO de dos letras válido, como PE.",
            ),
          ),
        );
        yield* Effect.sync(() =>
          process.stderr.write(`${countryTravelNotice(countryCode)}\n`),
        );
      } else {
        if (current.data.registration.countryCode) return current;
        if (
          options.output === "json" ||
          !process.stdin.isTTY ||
          !process.stdout.isTTY
        ) {
          return yield* cliError(
            "INPUT_REQUIRED",
            "Indica tu país de residencia con --code, por ejemplo: andes country --code PE",
          );
        }
        countryCode = yield* selectCountry().pipe(
          Effect.mapError(() =>
            cliError("PROMPT_CANCELLED", "Selección de país cancelada."),
          ),
        );
      }
      return yield* selectRegistrationCountry(client, countryCode);
    });
    yield* execute(options.output, operation, registrationText);
  }),
).pipe(
  Command.withDescription(
    "Selecciona tu país de residencia una sola vez; solo el equipo puede corregirlo",
  ),
);

const requirementsCommand = Command.make(
  "requirements",
  {},
  Effect.fn("requirementsCommand")(function* () {
    const options = yield* root;
    const operation = Effect.gen(function* () {
      const token = Option.getOrUndefined(options.token);
      return yield* getRegistration({ apiUrl: options.apiUrl, token });
    });
    yield* execute(
      options.output,
      withRegistrationNextStep(operation),
      requirementsOnlyText,
      registrationLookupErrorText,
    );
  }),
).pipe(Command.withDescription("Show information you still need to provide"));

const badgeRegenerateCommand = Command.make(
  "regenerate",
  {
    input: inputFlag,
    picture: Flag.string("picture").pipe(
      Flag.optional,
      Flag.withDescription("Ruta a una foto JPEG, PNG o WebP (máximo 5 MB)"),
    ),
  },
  Effect.fn("badgeRegenerateCommand")(function* ({ input, picture }) {
    const options = yield* root;
    const operation = Effect.gen(function* () {
      const inputPath = Option.getOrUndefined(input);
      if (options.output === "json" && inputPath === undefined) {
        return yield* Effect.fail(
          cliError(
            "INPUT_REQUIRED",
            "El modo JSON requiere --input <archivo> o --input -",
          ),
        );
      }
      const token = Option.getOrUndefined(options.token);
      const client = { apiUrl: options.apiUrl, token };
      const current = yield* getRegistration(client);
      if (current.data.requirements.stage !== "complete") {
        return yield* cliError(
          "INVALID_APPLICATION_STATE",
          nextStepText(nextStepFor(current.data)),
        );
      }
      const badge = yield* getBadge(client);
      if (!badge.data.profile) {
        return yield* Effect.fail(
          cliError(
            "INVALID_APPLICATION_STATE",
            "Confirma tu asistencia antes de regenerar tu carnet",
          ),
        );
      }
      const currentUser = yield* getCurrentUser(client);
      const body = yield* badgeProfileInput(inputPath, badge.data.profile, {
        clerkPictureUrl: currentUser.data.clerkPictureUrl,
        githubUrl: current.data.registration.githubUrl,
      });
      const picturePath = Option.getOrUndefined(picture);
      if (body.pictureSource === "upload") {
        if (options.output === "json" && picturePath === undefined) {
          return yield* Effect.fail(
            cliError(
              "PICTURE_PATH_REQUIRED",
              "Usa --picture <ruta> cuando pictureSource es upload",
            ),
          );
        }
        const path = yield* picturePathInput(picturePath);
        yield* uploadPicture(client, path);
      } else if (picturePath) {
        return yield* Effect.fail(
          cliError(
            "UNEXPECTED_PICTURE_PATH",
            "--picture solo se puede usar cuando pictureSource es upload",
          ),
        );
      }
      return yield* regenerateBadge(client, body);
    });
    yield* execute(options.output, operation, badgeText);
  }),
).pipe(
  Command.withDescription(
    "Actualiza la foto, el nombre, la presentación y el enlace QR del carnet",
  ),
);

const badgeCommand = Command.make(
  "badge",
  {},
  Effect.fn("badgeCommand")(function* () {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    const client = { apiUrl: options.apiUrl, token };
    const operation = Effect.gen(function* () {
      const current = yield* getRegistration(client);
      if (current.data.registration.status !== "accepted") {
        return yield* cliError(
          "INVALID_APPLICATION_STATE",
          nextStepText(nextStepFor(current.data)),
        );
      }
      const badge = yield* getBadge(client);
      return {
        ...badge,
        data: { ...badge.data, nextStep: nextStepFor(current.data) },
      };
    });
    yield* execute(
      options.output,
      operation,
      (result) => {
        if (result.nextStep.kind === "confirm")
          return `Tu carnet predeterminado no confirma tu asistencia.\n${result.url ?? "El carnet todavía se está preparando."}\n\n${nextStepText(result.nextStep)}`;
        return badgeText(result);
      },
      registrationLookupErrorText,
    );
  }),
).pipe(
  Command.withDescription("Muestra o regenera tu carnet de participante"),
  Command.withSubcommands([badgeRegenerateCommand]),
);

const confirmCommand = Command.make(
  "confirm",
  {
    input: inputFlag,
    picture: Flag.string("picture").pipe(
      Flag.optional,
      Flag.withDescription("Path to a JPEG, PNG, or WebP picture (5 MB max)"),
    ),
  },
  Effect.fn("confirmCommand")(function* ({ input, picture }) {
    const options = yield* root;
    const operation = Effect.gen(function* () {
      const token = Option.getOrUndefined(options.token);
      const client = { apiUrl: options.apiUrl, token };
      const current = yield* getRegistration(client);
      if (
        current.data.requirements.stage === "complete" &&
        Option.isNone(input) &&
        Option.isNone(picture)
      )
        return current;
      if (!current.data.requirements.canSubmitAcceptedDetails) {
        return yield* Effect.fail(
          cliError(
            "INVALID_APPLICATION_STATE",
            nextStepText(nextStepFor(current.data)),
          ),
        );
      }
      if (options.output === "json" && Option.isNone(input)) {
        return yield* cliError(
          "INPUT_REQUIRED",
          "El modo JSON requiere --input <archivo> o --input -",
        );
      }
      const currentUser = yield* getCurrentUser(client);
      const currentBadge = yield* getBadge(client);
      const body = yield* acceptedDetailsInput(
        Option.getOrUndefined(input),
        current.data.registration.participationMode,
        {
          clerkPictureUrl: currentUser.data.clerkPictureUrl,
          githubUrl: current.data.registration.githubUrl,
          currentPhone: current.data.registration.phone,
          currentName: currentBadge.data.profile?.fullName,
          currentOneLiner:
            currentBadge.data.profile?.oneLiner ??
            current.data.registration.role,
          currentFullName:
            current.data.registration.fullName ||
            joinFullName(
              current.data.registration.firstName,
              current.data.registration.lastName,
            ),
        },
      );
      const picturePath = Option.getOrUndefined(picture);
      if (body.pictureSource === "upload") {
        if (options.output === "json" && picturePath === undefined) {
          return yield* cliError(
            "PICTURE_PATH_REQUIRED",
            "Usa --picture <ruta> cuando pictureSource es upload",
          );
        }
        const path = yield* picturePathInput(picturePath);
        yield* uploadPicture(client, path);
      } else if (picturePath) {
        return yield* cliError(
          "UNEXPECTED_PICTURE_PATH",
          "--picture can only be used when pictureSource is upload",
        );
      }
      return yield* confirmAttendance(client, body);
    });
    yield* execute(
      options.output,
      withRegistrationNextStep(operation),
      registrationText,
      registrationLookupErrorText,
    );
  }),
).pipe(
  Command.withDescription(
    "Provide private attendance details after acceptance",
  ),
  Command.withExamples([
    {
      command: "andes confirm",
      description: "Complete accepted-participant details interactively",
    },
    {
      command: "andes --output json confirm --input attendance.json",
      description: "Submit accepted-participant details from JSON",
    },
  ]),
);

const loginCommand = Command.make(
  "login",
  {},
  Effect.fn("loginCommand")(function* () {
    const options = yield* root;
    const operation = Effect.gen(function* () {
      const token = yield* Effect.tryPromise({
        try: () => oauthLogin(),
        catch: (error) => cliError("LOGIN_FAILED", String(error)),
      });
      const currentUser = yield* getCurrentUser({
        apiUrl: options.apiUrl,
        token,
      });
      const environmentTokenActive = Boolean(process.env.CHOFEX_TOKEN);
      const nextStep = yield* loadParticipantGuidance({
        apiUrl: options.apiUrl,
        token,
      }).pipe(
        Effect.map((response) => response.data.nextStep),
        Effect.catch(() =>
          Effect.succeed({
            kind: "status",
            message: "Consulta tu avance para continuar con tu siguiente paso.",
            command: "andes",
          } satisfies NextStep),
        ),
      );
      return {
        version: 1 as const,
        ok: true as const,
        requestId: currentUser.requestId,
        data: {
          authenticated: true as const,
          environmentTokenActive,
          nextStep,
        },
      };
    });
    yield* execute(options.output, operation, (result) => {
      if (result.environmentTokenActive) {
        return "Sesión iniciada. CHOFEX_TOKEN está configurado y tiene prioridad sobre la sesión guardada; elimínalo del entorno para usar esta sesión.\nSiguiente comando: andes";
      }
      return `Sesión iniciada.\n${result.nextStep.message}\nSiguiente comando: ${result.nextStep.command}`;
    });
  }),
).pipe(Command.withDescription("Sign in through Clerk OAuth in your browser"));

const logoutCommand = Command.make(
  "logout",
  {},
  Effect.fn("logoutCommand")(function* () {
    const options = yield* root;
    const operation = Effect.tryPromise({
      try: async () => {
        await oauthLogout();
        const environmentTokenActive = Boolean(process.env.CHOFEX_TOKEN);
        return {
          version: 1 as const,
          ok: true as const,
          requestId: crypto.randomUUID(),
          data: {
            storedCredentialsRemoved: true as const,
            environmentTokenActive,
          },
        };
      },
      catch: (error) => cliError("LOGOUT_FAILED", String(error)),
    });
    yield* execute(options.output, operation, (result) => {
      if (result.environmentTokenActive) {
        return "Stored credentials removed. CHOFEX_TOKEN remains active; unset it to stop using that token.";
      }
      return "Sesión cerrada. Para volver a continuar tu postulación:\nSiguiente comando: andes login";
    });
  }),
).pipe(Command.withDescription("Revoke and remove locally stored credentials"));

const whoamiCommand = Command.make(
  "whoami",
  {},
  Effect.fn("whoamiCommand")(function* () {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    const operation = getCurrentUser({ apiUrl: options.apiUrl, token });
    yield* execute(
      options.output,
      operation,
      (result) =>
        `Sesión iniciada como ${result.email} (${result.userId}, ${result.tokenType}).\nConsulta tu siguiente paso: andes`,
    );
  }),
).pipe(Command.withDescription("Verify the current Clerk authentication"));

const makeUpgradeCommand = (name: "update" | "upgrade") =>
  Command.make(
    name,
    {},
    Effect.fn("upgradeCommand")(function* () {
      const options = yield* root;
      const operation = Effect.tryPromise({
        try: async () => {
          await updateChofex();
          return {
            version: 1 as const,
            ok: true as const,
            requestId: crypto.randomUUID(),
            data: {
              packageName: cliPackageName,
              requestedVersion: upgradeVersion,
              skillName,
            },
          };
        },
        catch: (error) =>
          cliError(
            "UPGRADE_FAILED",
            `No se pudieron actualizar ${cliPackageName} y ${skillName}`,
            false,
            String(error),
          ),
      });
      yield* execute(
        options.output,
        operation,
        () =>
          `Se actualizó ${cliPackageName} a la versión ${upgradeVersion} y se refrescó ${skillName}.\nSiguiente comando: andes`,
      );
    }),
  ).pipe(
    Command.withDescription(
      `Actualiza ${cliPackageName} y su skill de agente a la última versión`,
    ),
  );

const updateCommand = makeUpgradeCommand("update");
const upgradeCommand = makeUpgradeCommand("upgrade");

const inputValidation = (stage: InputStage, path: string | undefined) => {
  if (stage === "application") {
    return applicationInput(path, config.publicSiteUrl).pipe(Effect.asVoid);
  }
  return acceptedDetailsInput(path, "in_person").pipe(Effect.asVoid);
};

const validateCommand = Command.make(
  "validate",
  { input: inputFlag, stage: stageFlag },
  Effect.fn("validateCommand")(function* ({ input, stage }) {
    const options = yield* root;
    if (options.output === "json" && Option.isNone(input)) {
      yield* execute(
        options.output,
        Effect.fail(
          cliError(
            "INPUT_REQUIRED",
            "El modo JSON requiere --input <archivo> o --input -",
          ),
        ),
        () => "",
      );
      return;
    }
    const operation = inputValidation(stage, Option.getOrUndefined(input)).pipe(
      Effect.map(() => ({
        version: 1 as const,
        ok: true as const,
        requestId: crypto.randomUUID(),
        data: { valid: true as const, stage },
      })),
    );
    yield* execute(options.output, operation, (result) => {
      const command =
        result.stage === "application" ? "andes register" : "andes confirm";
      let nextCommand = command;
      if (Option.isSome(input))
        nextCommand += ` --input ${JSON.stringify(input.value)}`;
      return `Datos válidos. Todavía no se enviaron.\nSiguiente comando: ${nextCommand}`;
    });
  }),
).pipe(
  Command.withDescription("Validate input without submitting it"),
  Command.withExamples([
    {
      command:
        "andes --output json validate --stage application --input application.json",
      description: "Validate an application file locally",
    },
  ]),
);

const applicationTemplate = {
  countryCode: "PE",
  fullName: "Ada Lovelace",
  role: "Programmer",
  phone: "+51 999 999 999",
  bio: "I build tools that help people collaborate.",
  portfolioUrl: "https://ada.example.com",
  shippedProject: "An open-source analytical engine simulator.",
  githubUrl: "https://github.com/ada-lovelace",
  linkedInUrl: "https://linkedin.com/in/ada-lovelace",
  codeOfConductAccepted: true,
};

const acceptanceTemplate = {
  fullName: "Ada Lovelace",
  name: "Ada L.",
  oneLiner: "Computing pioneer",
  phone: "+44 20 0000 0000",
  dateOfBirth: "1990-01-01",
  nationalIdNumber: "passport-or-national-id",
  shirtSize: "m",
  dietaryRestrictions: "Vegetarian",
  accessibilityNeeds: "Wheelchair-accessible workspace",
  emergencyContactName: "Grace Hopper",
  emergencyContactPhone: "+1 555 0100",
  mediaConsent: false,
  pictureSource: "github",
};

const templateFor = (stage: InputStage) => {
  if (stage === "application") return applicationTemplate;
  return acceptanceTemplate;
};

const schemaCommand = Command.make(
  "schema",
  { stage: stageFlag },
  Effect.fn("schemaCommand")(function* ({ stage }) {
    yield* printJson(templateFor(stage));
  }),
).pipe(
  Command.withDescription("Print a complete machine-readable input template"),
  Command.withExamples([
    {
      command: "andes schema --stage acceptance",
      description: "Print the post-acceptance input template",
    },
  ]),
);

export const command = root.pipe(
  Command.withHandler((options) =>
    Effect.gen(function* () {
      const client = {
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      };
      yield* execute(
        options.output,
        loadParticipantGuidance(client),
        (result) => {
          const welcome = renderWelcome({
            columns: process.stdout.columns ?? 80,
            colors:
              process.stdout.isTTY === true &&
              process.env.NO_COLOR === undefined,
          });
          const guidance = result.registration
            ? registrationText(result.registration)
            : nextStepText(result.nextStep);
          return `${welcome}\n${guidance}\n\nTodos los comandos: andes --help`;
        },
      );
    }),
  ),
  Command.withSubcommands([
    loginCommand,
    logoutCommand,
    whoamiCommand,
    updateCommand,
    upgradeCommand,
    validateCommand,
    registerCommand,
    statusCommand,
    countryCommand,
    requirementsCommand,
    badgeCommand,
    confirmCommand,
    schemaCommand,
    challengeCommand,
  ]),
);
