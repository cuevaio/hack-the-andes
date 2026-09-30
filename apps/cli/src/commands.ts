import { joinFullName } from "@chofex/registration-contract";
import { Console, Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import {
  confirmAttendance,
  getBadge,
  getCurrentUser,
  getRegistration,
  regenerateBadge,
  register,
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
import { uploadPicture } from "./picture-upload.js";
import {
  cliPackageName,
  skillName,
  updateChofex,
  upgradeVersion,
} from "./upgrade.js";

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

const rejectIfApplicationLocked = Effect.fn("rejectIfApplicationLocked")(
  function* (
    current: Option.Option<{
      data: {
        registration: { status: string };
        requirements: { stage: string };
      };
    }>,
  ) {
    if (Option.isNone(current)) return;
    const { registration, requirements } = current.value.data;
    const { status } = registration;
    const registrationAlreadyExists =
      status === "submitted" ||
      status === "under_review" ||
      status === "waitlisted" ||
      status === "accepted";
    if (!registrationAlreadyExists) return;
    let message = "Already registered. Wait for approval.";
    if (status === "accepted") {
      message = "Already accepted. Your registration is complete.";
      if (requirements.stage === "accepted") {
        message =
          "Already accepted. Run `chofex confirm` to complete your registration.";
      }
    }
    return yield* cliError("ACTIVE_APPLICATION_EXISTS", message, false, {
      currentStatus: status,
    });
  },
);

const registerCommand = Command.make(
  "register",
  { input: inputFlag },
  Effect.fn("registerCommand")(function* ({ input }) {
    const options = yield* root;
    const operation = Effect.gen(function* () {
      const token = Option.getOrUndefined(options.token);
      const client = { apiUrl: options.apiUrl, token };
      const current = yield* currentRegistration(client);
      yield* rejectIfApplicationLocked(current);

      if (Option.isSome(input)) {
        const body = yield* applicationInput(input.value, config.publicSiteUrl);
        return yield* register(client, body);
      }

      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        return yield* cliError(
          "INPUT_REQUIRED",
          "Non-interactive use requires --input <file>, or --input - for stdin",
        );
      }

      return yield* interactiveRegister(client, current);
    });
    yield* execute(options.output, operation, createdText);
  }),
).pipe(
  Command.withDescription("Complete and submit an application for review"),
  Command.withExamples([
    {
      command: "chofex register",
      description: "Fill or resume the application interactively",
    },
    {
      command: "chofex --output json register --input application.json",
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
      operation,
      registrationText,
      registrationLookupErrorText,
    );
  }),
).pipe(Command.withDescription("Show your latest application and next steps"));

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
      operation,
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
      const badge = yield* getBadge(client);
      if (!badge.data.profile) {
        return yield* Effect.fail(
          cliError(
            "INVALID_APPLICATION_STATE",
            "Confirma tu asistencia antes de regenerar tu carnet",
          ),
        );
      }
      const [current, currentUser] = yield* Effect.all([
        getRegistration(client),
        getCurrentUser(client),
      ]);
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
    const operation = getBadge({ apiUrl: options.apiUrl, token });
    yield* execute(options.output, operation, badgeText);
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
      if (!current.data.requirements.canSubmitAcceptedDetails) {
        return yield* Effect.fail(
          cliError(
            "INVALID_APPLICATION_STATE",
            "Acceptance details can only be submitted after acceptance",
          ),
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
    yield* execute(options.output, operation, registrationText);
  }),
).pipe(
  Command.withDescription(
    "Provide private attendance details after acceptance",
  ),
  Command.withExamples([
    {
      command: "chofex confirm",
      description: "Complete accepted-participant details interactively",
    },
    {
      command: "chofex --output json confirm --input attendance.json",
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
      return {
        version: 1 as const,
        ok: true as const,
        requestId: currentUser.requestId,
        data: {
          authenticated: true as const,
          environmentTokenActive,
        },
      };
    });
    yield* execute(options.output, operation, (result) => {
      if (result.environmentTokenActive) {
        return "Signed in successfully. CHOFEX_TOKEN is set and will override the stored session; unset it before running other commands.";
      }
      return "Signed in successfully.";
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
      return "Signed out successfully.";
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
        `Authenticated as ${result.email} (${result.userId}, ${result.tokenType}).`,
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
          `Se actualizó ${cliPackageName} a la versión ${upgradeVersion} y se refrescó ${skillName}.`,
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
    const operation = inputValidation(stage, Option.getOrUndefined(input)).pipe(
      Effect.map(() => ({
        version: 1 as const,
        ok: true as const,
        requestId: crypto.randomUUID(),
        data: { valid: true as const, stage },
      })),
    );
    yield* execute(
      options.output,
      operation,
      (result) => `${result.stage} input is valid.`,
    );
  }),
).pipe(
  Command.withDescription("Validate input without submitting it"),
  Command.withExamples([
    {
      command:
        "chofex --output json validate --stage application --input application.json",
      description: "Validate an application file locally",
    },
  ]),
);

const applicationTemplate = {
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
      command: "chofex schema --stage acceptance",
      description: "Print the post-acceptance input template",
    },
  ]),
);

export const command = root.pipe(
  Command.withSubcommands([
    loginCommand,
    logoutCommand,
    whoamiCommand,
    updateCommand,
    upgradeCommand,
    validateCommand,
    registerCommand,
    statusCommand,
    requirementsCommand,
    badgeCommand,
    confirmCommand,
    schemaCommand,
    challengeCommand,
  ]),
);
