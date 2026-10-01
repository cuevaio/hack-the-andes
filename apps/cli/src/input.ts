import { readFile } from "node:fs/promises";

import {
  AcceptedDetailsInput,
  ApplicationDraftInput,
  ApplicationInput,
  acceptedDetailsInputFieldNames,
  acceptedDetailsInputFields,
  acceptedDetailsSemanticRequirements,
  applicationDraftInputFieldNames,
  applicationInputFieldNames,
  applicationInputFields,
  applicationSemanticRequirements,
  type BadgeProfile,
  BadgeRegenerationInput,
  badgeRegenerationInputFieldNames,
  badgeRegenerationInputFields,
  countries,
  countrySelectionNotice,
  countryTravelNotice,
  dateOfBirthRequirement,
  joinFullName,
  type RegistrationView,
} from "@chofex/registration-contract";
import { Console, Effect, Schema } from "effect";
import { Prompt } from "effect/unstable/cli";
import type * as PromptModule from "effect/unstable/cli/Prompt";

import { CliError, cliError } from "./errors.js";
import { profileUsernamePrompt } from "./profile-username-prompt.js";

interface AcceptedDetailsDefaults {
  readonly clerkPictureUrl?: string;
  readonly githubUrl?: string;
  readonly currentFullName?: string;
  readonly currentName?: string;
  readonly currentOneLiner?: string;
  readonly currentPhone?: string;
}

const validatePromptValue = (
  schema: Schema.Decoder<unknown, never>,
  value: unknown,
): Effect.Effect<void, string> =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.asVoid,
    Effect.mapError((error) => error.message),
  );

const requiredText = (
  message: string,
  schema: Schema.Decoder<unknown, never>,
  defaultValue = "",
): Prompt.Prompt<string> =>
  Prompt.text({
    message,
    default: defaultValue,
    validate: (value) =>
      validatePromptValue(schema, value).pipe(Effect.as(value)),
  });

const optionalText = (
  message: string,
  schema: Schema.Decoder<unknown, never>,
  defaultValue = "",
): Prompt.Prompt<string> =>
  Prompt.text({
    message,
    default: defaultValue,
    validate: (value) => {
      if (value === "") return Effect.succeed(value);
      return validatePromptValue(schema, value).pipe(Effect.as(value));
    },
  });

export const dateOfBirthPrompt = (): Prompt.Prompt<string> =>
  Prompt.text({
    message: "Date of birth (YYYY-MM-DD)",
    validate: Effect.fn("validateDateOfBirth")(function* (value) {
      yield* validatePromptValue(acceptedDetailsInputFields.dateOfBirth, value);
      const requirement = dateOfBirthRequirement(value);
      if (requirement) return yield* Effect.fail(requirement.reason);
      return value;
    }),
  });

const githubProfilePrefix = "github.com/";
const linkedInProfilePrefix = "linkedin.com/in/";

const profileUsernameFromUrl = (
  profileUrl: string | undefined,
  profilePrefix: string,
): string => {
  if (!profileUrl) return "";
  const normalized = profileUrl
    .replace(/^https?:\/\/(?:www\.)?/i, "")
    .replace(/\/$/, "");
  if (!normalized.toLowerCase().startsWith(profilePrefix)) return "";
  const username = normalized.slice(profilePrefix.length);
  if (!/^[A-Za-z0-9._-]+$/.test(username)) return "";
  return username;
};

const profileUrlPrompt = (
  usernameMessage: string,
  urlMessage: string,
  profilePrefix: string,
  schema: Schema.Decoder<unknown, never>,
  defaultUrl: string | undefined,
): Prompt.Prompt<string> => {
  const defaultUsername = profileUsernameFromUrl(defaultUrl, profilePrefix);
  if (defaultUrl && !defaultUsername) {
    return optionalText(urlMessage, schema, defaultUrl);
  }
  return profileUsernamePrompt(
    usernameMessage,
    profilePrefix,
    (value) => {
      if (value === "") return Effect.succeed(value);
      return validatePromptValue(schema, `${profilePrefix}${value}`).pipe(
        Effect.as(value),
      );
    },
    defaultUsername,
  ).pipe(
    Prompt.map((value) => {
      if (value === "") return value;
      return `${profilePrefix}${value}`;
    }),
  );
};

const withoutEmptyStrings = (
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== "" && value !== undefined && value !== null,
    ),
  );

export const applicationDefaultsFromRegistration = (
  registration: RegistrationView,
): Partial<ApplicationInput> => ({
  countryCode: registration.countryCode,
  fullName: joinFullName(registration.firstName, registration.lastName),
  role: registration.role,
  phone: registration.applicationPhone,
  bio: registration.bio,
  portfolioUrl: registration.portfolioUrl,
  shippedProject: registration.shippedProject,
  githubUrl: registration.githubUrl,
  linkedInUrl: registration.linkedInUrl,
  codeOfConductAccepted: registration.codeOfConductAccepted ? true : undefined,
});

const readStdin = async (): Promise<string> => {
  const chunks: Array<Buffer> = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const readJsonInput = (path: string): Effect.Effect<unknown, CliError> =>
  Effect.tryPromise({
    try: async () => {
      let contents: string;
      if (path === "-") {
        contents = await readStdin();
      } else {
        contents = await readFile(path, "utf8");
      }
      return JSON.parse(contents) as unknown;
    },
    catch: (error) =>
      cliError(
        "INVALID_INPUT_FILE",
        `Could not read JSON input from ${path}: ${String(error)}`,
      ),
  });

const decode = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown,
  acceptedFields: ReadonlyArray<string>,
): Effect.Effect<S["Type"], CliError, S["DecodingServices"]> =>
  Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError((error) =>
      cliError("VALIDATION_ERROR", "Input validation failed", false, {
        issues: String(error),
        acceptedFields,
      }),
    ),
  );

const validateSemantics = <A>(
  input: A,
  requirements: ReadonlyArray<{
    readonly field: string;
    readonly reason: string;
  }>,
): Effect.Effect<A, CliError> => {
  if (requirements.length === 0) return Effect.succeed(input);
  return Effect.fail(
    cliError("VALIDATION_ERROR", "Input validation failed", false, {
      issues: requirements,
    }),
  );
};

const applicationPrompts = (defaults: Partial<ApplicationInput>) =>
  Prompt.all({
    fullName: requiredText(
      "Full name",
      applicationInputFields.fullName,
      defaults.fullName,
    ),
    role: requiredText("Role", applicationInputFields.role, defaults.role),
    phone: optionalText(
      "Phone number (optional)",
      applicationInputFields.phone,
      defaults.phone,
    ),
    bio: optionalText(
      "Short bio (optional)",
      applicationInputFields.bio,
      defaults.bio,
    ),
    portfolioUrl: optionalText(
      "Portfolio URL (optional)",
      applicationInputFields.portfolioUrl,
      defaults.portfolioUrl,
    ),
    shippedProject: optionalText(
      "What have you shipped? (optional)",
      applicationInputFields.shippedProject,
      defaults.shippedProject,
    ),
    linkedInUrl: profileUrlPrompt(
      "LinkedIn username (optional)",
      "LinkedIn URL (optional)",
      linkedInProfilePrefix,
      applicationInputFields.linkedInUrl,
      defaults.linkedInUrl,
    ),
    githubUrl: profileUrlPrompt(
      "GitHub username (optional)",
      "GitHub URL (optional)",
      githubProfilePrefix,
      applicationInputFields.githubUrl,
      defaults.githubUrl,
    ),
  });

export const publicDocumentUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/$/, "")}${path}`;

const requiredAgreement = Effect.fn("requiredAgreement")(function* (
  name: string,
  url: string,
  initial = false,
) {
  const accepted = yield* Prompt.run(
    Prompt.confirm({
      message: `Do you accept the ${name}? Read it at ${url}`,
      initial,
    }),
  );
  if (accepted) return true as const;

  const nextStep = yield* Prompt.run(
    Prompt.select({
      message: `You must accept the ${name} to register. What would you like to do?`,
      choices: [
        {
          title: "I accept and want to continue",
          value: "accept" as const,
        },
        { title: "Cancel registration", value: "cancel" as const },
      ],
    }),
  );
  if (nextStep === "accept") return true as const;

  return yield* cliError(
    "REGISTRATION_CANCELLED",
    "Registration cancelled. Your answers were not submitted.",
  );
});

export const normalizeDraftFields = (
  input: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value === "" ? null : value]),
  );

export const collectApplicationFields = (
  publicBaseUrl: string,
  defaults: Partial<ApplicationInput>,
): Effect.Effect<Record<string, unknown>, CliError, PromptModule.Environment> =>
  Effect.gen(function* () {
    const countryCode = yield* selectCountry(defaults.countryCode);
    const profile = yield* Prompt.run(applicationPrompts(defaults));
    const codeOfConductAccepted = yield* requiredAgreement(
      "Terms and Conditions",
      publicDocumentUrl(publicBaseUrl, "/terms"),
      defaults.codeOfConductAccepted,
    );
    return normalizeDraftFields({
      countryCode,
      ...profile,
      codeOfConductAccepted,
    });
  }).pipe(
    Effect.mapError((error) => {
      if (error instanceof CliError) return error;
      return cliError("PROMPT_CANCELLED", "Interactive input was cancelled");
    }),
  );

export const countryPrompt = () =>
  Prompt.autoComplete({
    message: "¿En qué país resides?",
    filterLabel: "País",
    filterPlaceholder: "Escribe para buscar",
    emptyMessage: "No se encontraron países",
    choices: countries.map(({ code, name, flag }) => ({
      title: `${flag} ${name} (${code})`,
      value: code,
    })),
  });

export const selectCountry = Effect.fn("selectCountry")(function* (
  currentCountry?: string,
) {
  if (currentCountry) return currentCountry;
  yield* Console.error(countrySelectionNotice);
  const countryCode = yield* Prompt.run(countryPrompt());
  yield* Console.error(countryTravelNotice(countryCode));
  return countryCode;
});

const shirtSizePrompt = (
  participationMode: "in_person" | "remote",
): PromptModule.Prompt<string | undefined> => {
  if (participationMode === "remote") return Prompt.succeed(undefined);
  return Prompt.select({
    message: "Shirt size",
    choices: ["xs", "s", "m", "l", "xl", "2xl", "3xl", "prefer_not_to_say"].map(
      (value) => ({ title: value.toUpperCase(), value }),
    ),
  });
};

const interactiveAcceptedDetails = (
  participationMode: "in_person" | "remote",
  defaults: AcceptedDetailsDefaults,
) =>
  Effect.gen(function* () {
    let fullName = defaults.currentFullName;
    if (fullName) {
      const nameChoice = yield* Prompt.run(
        Prompt.select({
          message: `Is "${fullName}" your full name exactly as it appears on your ID document?`,
          choices: [
            { title: "Yes, use this name", value: "keep" as const },
            { title: "No, update it", value: "update" as const },
          ],
        }),
      );
      if (nameChoice === "update") fullName = undefined;
    }
    if (!fullName) {
      fullName = yield* Prompt.run(
        requiredText(
          "Full name exactly as it appears on your ID document",
          acceptedDetailsInputFields.fullName,
        ),
      );
    }
    const name = yield* Prompt.run(
      requiredText(
        "Nombre impreso en tu carnet",
        acceptedDetailsInputFields.fullName,
        defaults.currentName ?? fullName,
      ),
    );
    const oneLiner = yield* Prompt.run(
      requiredText(
        "Presentación de una línea para tu carnet",
        badgeRegenerationInputFields.oneLiner,
        defaults.currentOneLiner,
      ),
    );
    const details = yield* Prompt.run(
      Prompt.all({
        phone: optionalText(
          "Teléfono para WhatsApp (opcional)",
          acceptedDetailsInputFields.phone,
          defaults.currentPhone,
        ),
        dateOfBirth: dateOfBirthPrompt(),
        nationalIdNumber: requiredText(
          "National ID or passport number",
          acceptedDetailsInputFields.nationalIdNumber,
        ),
        shirtSize: shirtSizePrompt(participationMode),
        dietaryRestrictions: optionalText(
          "Dietary restrictions (optional)",
          acceptedDetailsInputFields.dietaryRestrictions,
        ),
        accessibilityNeeds: optionalText(
          "Accessibility needs (optional)",
          acceptedDetailsInputFields.accessibilityNeeds,
        ),
        emergencyContactName: requiredText(
          "Emergency contact name",
          acceptedDetailsInputFields.emergencyContactName,
        ),
        emergencyContactPhone: requiredText(
          "Emergency contact phone",
          acceptedDetailsInputFields.emergencyContactPhone,
        ),
        mediaConsent: Prompt.confirm({
          message: "Do you consent to appearing in event media?",
        }),
      }),
    );
    const pictureChoices: Array<{
      readonly title: string;
      readonly value: "clerk" | "github" | "upload";
    }> = [];
    if (defaults.clerkPictureUrl) {
      pictureChoices.push({
        title: `Usar mi foto de Clerk (${defaults.clerkPictureUrl})`,
        value: "clerk",
      });
    }
    if (defaults.githubUrl) {
      pictureChoices.push({
        title: `Usar mi foto de GitHub (${defaults.githubUrl})`,
        value: "github",
      });
    }
    pictureChoices.push({
      title: "Subir una foto diferente",
      value: "upload",
    });
    const pictureSource = yield* Prompt.run(
      Prompt.select({
        message: "Confirm the profile picture reviewers should use",
        choices: pictureChoices,
      }),
    );
    return withoutEmptyStrings({
      fullName,
      name,
      oneLiner,
      ...details,
      pictureSource,
    });
  });

const inputOrInteractive = (
  path: string | undefined,
  interactive: Effect.Effect<unknown, unknown, PromptModule.Environment>,
): Effect.Effect<unknown, CliError, PromptModule.Environment> => {
  if (path) return readJsonInput(path);
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Effect.fail(
      cliError(
        "INPUT_REQUIRED",
        "Non-interactive use requires --input <file>, or --input - for stdin",
      ),
    );
  }
  return interactive.pipe(
    Effect.mapError((error) => {
      if (error instanceof CliError) return error;
      return cliError("PROMPT_CANCELLED", "Interactive input was cancelled");
    }),
  );
};

export const applicationInput = (
  path: string | undefined,
  publicBaseUrl: string,
  defaults: Partial<ApplicationInput> = {},
): Effect.Effect<ApplicationInput, CliError, PromptModule.Environment> =>
  inputOrInteractive(
    path,
    collectApplicationFields(publicBaseUrl, defaults).pipe(
      Effect.map((input) => withoutEmptyStrings(input)),
    ),
  ).pipe(
    Effect.flatMap((input) =>
      decode(ApplicationInput, input, applicationInputFieldNames),
    ),
    Effect.flatMap((input) =>
      validateSemantics(input, applicationSemanticRequirements(input)),
    ),
  );

export const applicationDraftInput = (
  path: string | undefined,
): Effect.Effect<ApplicationDraftInput, CliError> => {
  if (!path) {
    return Effect.fail(
      cliError(
        "INPUT_REQUIRED",
        "Non-interactive use requires --input <file>, or --input - for stdin",
      ),
    );
  }
  return readJsonInput(path).pipe(
    Effect.flatMap((input) =>
      decode(ApplicationDraftInput, input, applicationDraftInputFieldNames),
    ),
  );
};

export const acceptedDetailsInput = (
  path: string | undefined,
  participationMode: "in_person" | "remote",
  defaults: AcceptedDetailsDefaults = {},
): Effect.Effect<AcceptedDetailsInput, CliError, PromptModule.Environment> =>
  inputOrInteractive(
    path,
    interactiveAcceptedDetails(participationMode, defaults),
  ).pipe(
    Effect.flatMap((input) =>
      decode(AcceptedDetailsInput, input, acceptedDetailsInputFieldNames),
    ),
    Effect.flatMap((input) =>
      validateSemantics(
        input,
        acceptedDetailsSemanticRequirements(input, participationMode),
      ),
    ),
  );

export const picturePathInput = (
  suppliedPath: string | undefined,
): Effect.Effect<string, CliError, PromptModule.Environment> => {
  if (suppliedPath) return Effect.succeed(suppliedPath);
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Effect.fail(
      cliError(
        "PICTURE_PATH_REQUIRED",
        "Use --picture <path> when pictureSource is upload",
      ),
    );
  }
  return Prompt.run(
    requiredText(
      "Path to a JPEG, PNG, or WebP picture (5 MB maximum)",
      Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
    ),
  ).pipe(
    Effect.mapError(() =>
      cliError("PROMPT_CANCELLED", "Interactive input was cancelled"),
    ),
  );
};

export const badgeProfileInput = (
  path: string | undefined,
  defaults: BadgeProfile,
  pictures: {
    readonly clerkPictureUrl?: string;
    readonly githubUrl?: string;
  },
): Effect.Effect<
  BadgeRegenerationInput,
  CliError,
  PromptModule.Environment
> => {
  const interactive = Effect.gen(function* () {
    const publicFields = yield* Prompt.run(
      Prompt.all({
        fullName: requiredText(
          "Nombre impreso en el carnet",
          Schema.Trim.pipe(
            Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
          ),
          defaults.fullName,
        ),
        oneLiner: requiredText(
          "Presentación de una línea",
          Schema.Trim.pipe(
            Schema.check(Schema.isMinLength(1), Schema.isMaxLength(30)),
          ),
          defaults.oneLiner,
        ),
        linkUrl: requiredText(
          "Destino del QR",
          Schema.Trim.pipe(
            Schema.check(Schema.isMinLength(1), Schema.isMaxLength(2_048)),
          ),
          defaults.linkUrl,
        ),
      }),
    );
    const pictureChoices: Array<{
      readonly title: string;
      readonly value: "keep" | "clerk" | "github" | "upload";
    }> = [{ title: "Mantener mi foto actual", value: "keep" }];
    if (pictures.clerkPictureUrl) {
      pictureChoices.push({ title: "Usar mi foto de Clerk", value: "clerk" });
    }
    if (pictures.githubUrl) {
      pictureChoices.push({ title: "Usar mi foto de GitHub", value: "github" });
    }
    pictureChoices.push({
      title: "Subir otra foto",
      value: "upload",
    });
    const pictureChoice = yield* Prompt.run(
      Prompt.select({
        message: "Foto impresa en el carnet",
        choices: pictureChoices,
      }),
    );
    if (pictureChoice === "keep") return publicFields;
    return { ...publicFields, pictureSource: pictureChoice };
  });

  return inputOrInteractive(path, interactive).pipe(
    Effect.flatMap((input) =>
      decode(BadgeRegenerationInput, input, badgeRegenerationInputFieldNames),
    ),
  );
};
