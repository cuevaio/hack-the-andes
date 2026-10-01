import { ParticipantChallengeProgressSchema } from "@chofex/challenges-contract";
import { DateTime, Option, Schema, SchemaGetter } from "effect";
import { CountryCode } from "#countries";

export * from "#countries";

export const campaignAttributionHandoffHeader =
  "x-chofex-campaign-attribution" as const;

export interface CampaignAttributionHandoff {
  readonly capturedAt: number;
  readonly landingId: string;
}

const eventUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function campaignAttributionHandoffValue(
  handoff: CampaignAttributionHandoff,
): string | undefined {
  if (!eventUuidPattern.test(handoff.landingId)) return;
  if (!Number.isSafeInteger(handoff.capturedAt) || handoff.capturedAt < 0)
    return;
  return `${handoff.landingId}.${handoff.capturedAt}`;
}

export function campaignAttributionHandoffFromValue(
  value: string | null | undefined,
): CampaignAttributionHandoff | undefined {
  if (!value) return;
  const separator = value.lastIndexOf(".");
  if (separator < 0) return;
  const landingId = value.slice(0, separator);
  const capturedAt = Number(value.slice(separator + 1));
  const handoff = { capturedAt, landingId };
  if (campaignAttributionHandoffValue(handoff) !== value) return;
  return handoff;
}

export type CampaignAttributionOAuthState =
  | { readonly valid: false }
  | {
      readonly valid: true;
      readonly handoff?: CampaignAttributionHandoff;
    };

export function oauthStateWithCampaignAttribution(
  state: string,
  handoff: CampaignAttributionHandoff | undefined,
): string {
  if (!handoff) return state;
  const value = campaignAttributionHandoffValue(handoff);
  if (!value) return state;
  return `${state}.${value}`;
}

export function campaignAttributionFromOAuthState(
  expectedState: string,
  returnedState: string | null,
): CampaignAttributionOAuthState {
  if (returnedState === expectedState) return { valid: true };
  const prefix = `${expectedState}.`;
  if (!returnedState?.startsWith(prefix)) return { valid: false };
  const handoff = campaignAttributionHandoffFromValue(
    returnedState.slice(prefix.length),
  );
  if (!handoff) return { valid: false };
  return { valid: true, handoff };
}

const nonBlank = (maximum: number) =>
  Schema.Trim.pipe(
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(maximum)),
  );

const optionalText = (maximum: number) => Schema.optional(nonBlank(maximum));
const nullableOptionalText = (maximum: number) =>
  Schema.optional(Schema.NullOr(nonBlank(maximum)));
const phone = nonBlank(32);

const normalizedString = (normalize: (value: string) => string) =>
  Schema.String.pipe(
    Schema.decode({
      decode: SchemaGetter.transform(normalize),
      encode: SchemaGetter.transform((value) => value),
    }),
  );

const url = normalizedString((value) => {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}).pipe(
  Schema.check(
    Schema.isPattern(/^https?:\/\/[^\s]+$/i, {
      message: "Must be an http or https URL",
    }),
    Schema.isMaxLength(2_048),
  ),
);

export const RegistrationStatus = Schema.Literals([
  "draft",
  "submitted",
  "under_review",
  "waitlisted",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const ParticipationMode = Schema.Literals(["in_person", "remote"]);
export const hackathonParticipationMode = "in_person" as const;
export const TeamPreference = Schema.Literals([
  "have_team",
  "looking_for_team",
  "solo",
]);
export const ShirtSize = Schema.Literals([
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "2xl",
  "3xl",
  "prefer_not_to_say",
]);

export const PictureSource = Schema.Literals(["clerk", "github", "upload"]);

export const PictureContentType = Schema.Literals([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type PictureContentType = typeof PictureContentType.Type;
export const maximumPictureBytes = 5 * 1024 * 1024;

const bytesStartWith = (
  bytes: Uint8Array,
  signature: ReadonlyArray<number>,
): boolean => signature.every((value, index) => bytes[index] === value);

export const detectPictureContentType = (
  bytes: Uint8Array,
): PictureContentType | undefined => {
  if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  const isWebp =
    bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytesStartWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);
  if (isWebp) return "image/webp";
};

const givenNameMaximum = 100;
const familyNameMaximum = 100;

export const splitFullName = (
  fullName: string,
): { readonly firstName: string; readonly lastName: string } => {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  const tokens = normalized.split(" ");
  if (tokens.length === 1) {
    return { firstName: normalized, lastName: "" };
  }

  for (let index = tokens.length - 1; index >= 1; index--) {
    const firstName = tokens.slice(0, index).join(" ");
    const lastName = tokens.slice(index).join(" ");
    if (
      firstName.length <= givenNameMaximum &&
      lastName.length <= familyNameMaximum
    ) {
      return { firstName, lastName };
    }
  }

  const lastSpace = normalized.lastIndexOf(" ");
  return {
    firstName: normalized.slice(0, lastSpace),
    lastName: normalized.slice(lastSpace + 1),
  };
};

export const joinFullName = (
  firstName: string | undefined,
  lastName: string | undefined,
): string => {
  const given = firstName?.trim() ?? "";
  const family = lastName?.trim() ?? "";
  if (!family) return given;
  if (!given) return family;
  return `${given} ${family}`;
};

export const applicationInputFields = {
  countryCode: CountryCode,
  fullName: nonBlank(givenNameMaximum + familyNameMaximum + 1),
  role: nonBlank(120),
  phone: Schema.optional(phone),
  bio: optionalText(2_000),
  portfolioUrl: Schema.optional(url),
  shippedProject: optionalText(2_000),
  githubUrl: Schema.optional(url),
  linkedInUrl: Schema.optional(url),
  codeOfConductAccepted: Schema.Literal(true),
};

export const applicationInputFieldNames = Object.keys(applicationInputFields);

export const ApplicationInput = Schema.Struct(applicationInputFields);

export type ApplicationInput = typeof ApplicationInput.Type;

export const applicationDraftInputFields = {
  countryCode: Schema.optional(CountryCode),
  fullName: Schema.optional(applicationInputFields.fullName),
  role: nullableOptionalText(120),
  phone: Schema.optional(Schema.NullOr(phone)),
  bio: nullableOptionalText(2_000),
  portfolioUrl: Schema.optional(Schema.NullOr(url)),
  shippedProject: nullableOptionalText(2_000),
  githubUrl: Schema.optional(Schema.NullOr(url)),
  linkedInUrl: Schema.optional(Schema.NullOr(url)),
  codeOfConductAccepted: Schema.optional(Schema.Boolean),
};

export const applicationDraftInputFieldNames = Object.keys(
  applicationDraftInputFields,
);

export const ApplicationDraftInput = Schema.Struct(applicationDraftInputFields);

export type ApplicationDraftInput = typeof ApplicationDraftInput.Type;

export const applicationDraftReplacementFrom = (
  input: ApplicationInput,
): ApplicationDraftInput => ({
  ...input,
  phone: input.phone ?? null,
  bio: input.bio ?? null,
  portfolioUrl: input.portfolioUrl ?? null,
  shippedProject: input.shippedProject ?? null,
  githubUrl: input.githubUrl ?? null,
  linkedInUrl: input.linkedInUrl ?? null,
});

export const ApplicationPartId = Schema.Literals([
  "identity",
  "experience",
  "team",
  "agreements",
]);

export type ApplicationPartId = typeof ApplicationPartId.Type;

export const acceptedDetailsInputFields = {
  fullName: nonBlank(200),
  name: Schema.optional(nonBlank(200)),
  oneLiner: Schema.optional(nonBlank(30)),
  phone: Schema.optional(phone),
  dateOfBirth: Schema.String.pipe(
    Schema.check(
      Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/, {
        message: "Must use YYYY-MM-DD format",
      }),
    ),
  ),
  nationalIdNumber: nonBlank(100),
  shirtSize: Schema.optional(ShirtSize),
  dietaryRestrictions: optionalText(1_000),
  accessibilityNeeds: optionalText(1_000),
  emergencyContactName: nonBlank(200),
  emergencyContactPhone: phone,
  mediaConsent: Schema.optional(Schema.Boolean),
  pictureSource: PictureSource,
};

export const acceptedDetailsInputFieldNames = Object.keys(
  acceptedDetailsInputFields,
);

export const AcceptedDetailsInput = Schema.Struct(acceptedDetailsInputFields);

export type AcceptedDetailsInput = typeof AcceptedDetailsInput.Type;

export const initialRequiredFields = [
  "countryCode",
  "fullName",
  "role",
  "codeOfConductAccepted",
] as const;

export const acceptedRequiredFields = [
  "fullName",
  "dateOfBirth",
  "nationalIdNumber",
  "emergencyContactName",
  "emergencyContactPhone",
  "pictureSource",
] as const;

export const RequirementSchema = Schema.Struct({
  field: Schema.String,
  reason: Schema.String,
});

export type Requirement = typeof RequirementSchema.Type;

const inPersonShirtSizeRequirement: Requirement = {
  field: "shirtSize",
  reason: "Required for in-person participants",
};

const addShirtSizeRequirement = (
  requirements: Array<Requirement>,
  participationMode: typeof ParticipationMode.Type,
  shirtSize: typeof ShirtSize.Type | undefined,
): void => {
  if (participationMode === "in_person" && !shirtSize) {
    requirements.push(inPersonShirtSizeRequirement);
  }
};

export const fullNameColumnRequirements = (
  fullName: string,
): ReadonlyArray<Requirement> => {
  const { firstName, lastName } = splitFullName(fullName);
  if (
    firstName.length > givenNameMaximum ||
    lastName.length > familyNameMaximum
  ) {
    return [
      {
        field: "fullName",
        reason:
          "Must split into given and family names of 100 characters or fewer",
      },
    ];
  }
  return [];
};

export const applicationSemanticRequirements = (
  input: ApplicationInput,
): ReadonlyArray<Requirement> => fullNameColumnRequirements(input.fullName);

export const dateOfBirthRequirement = (
  dateOfBirth: string,
): Requirement | undefined => {
  const birthDate = DateTime.make(`${dateOfBirth}T00:00:00.000Z`);
  if (
    Option.isNone(birthDate) ||
    DateTime.formatIsoDateUtc(birthDate.value) !== dateOfBirth ||
    !DateTime.isPastUnsafe(birthDate.value)
  ) {
    return {
      field: "dateOfBirth",
      reason: "Must be a valid date in the past",
    };
  }
};

export const acceptedDetailsSemanticRequirements = (
  input: AcceptedDetailsInput,
  participationMode: typeof ParticipationMode.Type,
): ReadonlyArray<Requirement> => {
  const requirements: Array<Requirement> = [];
  addShirtSizeRequirement(requirements, participationMode, input.shirtSize);

  const invalidDateOfBirth = dateOfBirthRequirement(input.dateOfBirth);
  if (invalidDateOfBirth) requirements.push(invalidDateOfBirth);
  return requirements;
};

export const RegistrationViewSchema = Schema.Struct({
  id: Schema.String,
  status: RegistrationStatus,
  firstName: Schema.String,
  lastName: Schema.String,
  email: Schema.String,
  applicationPhone: Schema.optional(Schema.String),
  fullName: Schema.optional(Schema.String),
  phone: Schema.optional(Schema.String),
  dateOfBirth: Schema.optional(Schema.String),
  pronouns: Schema.optional(Schema.String),
  countryCode: Schema.optional(CountryCode),
  city: Schema.optional(Schema.String),
  participationMode: ParticipationMode,
  organization: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
  fieldOfStudy: Schema.optional(Schema.String),
  graduationYear: Schema.optional(Schema.Number),
  shippedProject: Schema.optional(Schema.String),
  hackathonProject: Schema.optional(Schema.String),
  bio: Schema.optional(Schema.String),
  githubUrl: Schema.optional(Schema.String),
  linkedInUrl: Schema.optional(Schema.String),
  portfolioUrl: Schema.optional(Schema.String),
  teamPreference: Schema.optional(TeamPreference),
  teamName: Schema.optional(Schema.String),
  shirtSize: Schema.optional(ShirtSize),
  nationalIdProvided: Schema.Boolean,
  dietaryRestrictions: Schema.optional(Schema.String),
  accessibilityNeeds: Schema.optional(Schema.String),
  emergencyContactName: Schema.optional(Schema.String),
  emergencyContactPhone: Schema.optional(Schema.String),
  mediaConsent: Schema.Boolean,
  pictureSource: Schema.optional(PictureSource),
  pictureUrl: Schema.optional(Schema.String),
  rejectionReason: Schema.optional(Schema.String),
  codeOfConductAccepted: Schema.Boolean,
  privacyPolicyAccepted: Schema.Boolean,
  submittedAt: Schema.optional(Schema.String),
  acceptanceDetailsCompletedAt: Schema.optional(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  challenges: Schema.Array(ParticipantChallengeProgressSchema),
});

export type RegistrationView = typeof RegistrationViewSchema.Type;

export const ApplicationPartSchema = Schema.Struct({
  id: ApplicationPartId,
  title: Schema.String,
  complete: Schema.Boolean,
  missing: Schema.Array(RequirementSchema),
});

export type ApplicationPart = typeof ApplicationPartSchema.Type;

export const RegistrationRequirementsSchema = Schema.Struct({
  stage: Schema.Literals([
    "draft",
    "review",
    "rejected",
    "accepted",
    "complete",
  ]),
  canSubmitNewApplication: Schema.Boolean,
  canSubmitAcceptedDetails: Schema.Boolean,
  canSaveDraft: Schema.Boolean,
  canSubmitApplication: Schema.Boolean,
  parts: Schema.Array(ApplicationPartSchema),
  missing: Schema.Array(RequirementSchema),
  rejectionReason: Schema.optional(Schema.String),
});

export type RegistrationRequirements =
  typeof RegistrationRequirementsSchema.Type;

const addMissingRequirement = (
  missing: Array<Requirement>,
  field: string,
  reason = "Required after acceptance",
): void => {
  missing.push({ field, reason });
};

const acceptedDetailsRequirementsFor = (
  registration: RegistrationView,
): ReadonlyArray<Requirement> => {
  const missing: Array<Requirement> = [];

  if (!registration.fullName) addMissingRequirement(missing, "fullName");
  if (!registration.dateOfBirth) {
    addMissingRequirement(missing, "dateOfBirth");
  }
  if (!registration.nationalIdProvided) {
    addMissingRequirement(missing, "nationalIdNumber");
  }
  if (!registration.emergencyContactName) {
    addMissingRequirement(missing, "emergencyContactName");
  }
  if (!registration.emergencyContactPhone) {
    addMissingRequirement(missing, "emergencyContactPhone");
  }
  if (!registration.pictureUrl) {
    addMissingRequirement(
      missing,
      "pictureSource",
      "Confirm a Clerk, GitHub, or uploaded picture",
    );
  }
  addShirtSizeRequirement(
    missing,
    registration.participationMode,
    registration.shirtSize,
  );

  return missing;
};

const requiredValue = (value: string | undefined): boolean =>
  Boolean(value && value.trim() !== "");

const part = (
  id: ApplicationPartId,
  title: string,
  missing: ReadonlyArray<Requirement>,
): ApplicationPart => ({
  id,
  title,
  complete: missing.length === 0,
  missing,
});

export const applicationPartsFor = (
  registration: RegistrationView,
): ReadonlyArray<ApplicationPart> => {
  const identityMissing: Array<Requirement> = [];
  if (!registration.countryCode) {
    identityMissing.push({
      field: "countryCode",
      reason: "Selecciona tu país de residencia",
    });
  }
  if (
    !requiredValue(joinFullName(registration.firstName, registration.lastName))
  ) {
    identityMissing.push({ field: "fullName", reason: "Required to submit" });
  }
  if (!requiredValue(registration.role)) {
    identityMissing.push({ field: "role", reason: "Required to submit" });
  }

  const agreementMissing: Array<Requirement> = [];
  if (!registration.codeOfConductAccepted) {
    agreementMissing.push({
      field: "codeOfConductAccepted",
      reason: "Required to submit",
    });
  }

  return [
    part("identity", "Profile", identityMissing),
    part("agreements", "Terms", agreementMissing),
  ];
};

const withApplicationParts = (
  requirements: Omit<
    RegistrationRequirements,
    "parts" | "canSaveDraft" | "canSubmitApplication"
  > &
    Partial<
      Pick<
        RegistrationRequirements,
        "parts" | "canSaveDraft" | "canSubmitApplication"
      >
    >,
  registration: RegistrationView,
): RegistrationRequirements => {
  const parts = requirements.parts ?? applicationPartsFor(registration);
  const draftMissing = parts.flatMap((item) => item.missing);
  const canSaveDraft = requirements.canSaveDraft ?? false;
  let canSubmitApplication = requirements.canSubmitApplication ?? false;
  if (requirements.stage === "draft") {
    canSubmitApplication = draftMissing.length === 0;
  }
  let missing = requirements.missing;
  if (requirements.stage === "draft") missing = draftMissing;
  return {
    ...requirements,
    parts,
    canSaveDraft,
    canSubmitApplication,
    missing,
  };
};

export const applicationRequirementsFor = (
  registration: RegistrationView,
): RegistrationRequirements => {
  switch (registration.status) {
    case "rejected":
      return withApplicationParts(
        {
          stage: "rejected",
          canSubmitNewApplication: true,
          canSubmitAcceptedDetails: false,
          missing: [],
          rejectionReason: registration.rejectionReason,
        },
        registration,
      );
    case "withdrawn":
      return withApplicationParts(
        {
          stage: "review",
          canSubmitNewApplication: true,
          canSubmitAcceptedDetails: false,
          missing: [],
        },
        registration,
      );
    case "accepted": {
      const missing = acceptedDetailsRequirementsFor(registration);
      const isComplete =
        Boolean(registration.acceptanceDetailsCompletedAt) &&
        missing.length === 0;
      return withApplicationParts(
        {
          stage: isComplete ? "complete" : "accepted",
          canSubmitNewApplication: false,
          canSubmitAcceptedDetails: true,
          missing,
          parts: [],
        },
        registration,
      );
    }
    case "draft":
      return withApplicationParts(
        {
          stage: "draft",
          canSubmitNewApplication: false,
          canSubmitAcceptedDetails: false,
          canSaveDraft: true,
          missing: [],
        },
        registration,
      );
    case "submitted":
    case "under_review":
    case "waitlisted":
      return withApplicationParts(
        {
          stage: "review",
          canSubmitNewApplication: false,
          canSubmitAcceptedDetails: false,
          missing: [],
        },
        registration,
      );
  }
};

export interface ApiSuccess<A> {
  readonly version: 1;
  readonly ok: true;
  readonly requestId: string;
  readonly data: A;
}

export const ApiFailureSchema = Schema.Struct({
  version: Schema.Literal(1),
  ok: Schema.Literal(false),
  requestId: Schema.String,
  error: Schema.Struct({
    code: Schema.String,
    message: Schema.String,
    retryable: Schema.Boolean,
    details: Schema.optional(Schema.Unknown),
  }),
});

export type ApiFailure = typeof ApiFailureSchema.Type;

export type ApiResponse<A> = ApiSuccess<A> | ApiFailure;

export const CurrentUserSchema = Schema.Struct({
  authenticated: Schema.Literal(true),
  userId: Schema.String,
  email: Schema.String,
  tokenType: Schema.Literals(["oauth_token", "session_token"]),
  clerkPictureUrl: Schema.optional(Schema.String),
});

export type CurrentUser = typeof CurrentUserSchema.Type;

export const BadgeStatus = Schema.Literals([
  "not_started",
  "pending",
  "running",
  "completed",
  "failed",
]);

export const BadgeProfileSchema = Schema.Struct({
  fullName: nonBlank(200),
  oneLiner: nonBlank(30),
  linkUrl: url,
  placement: Schema.String,
});

export type BadgeProfile = typeof BadgeProfileSchema.Type;

export const BadgeResultSchema = Schema.Struct({
  status: BadgeStatus,
  url: Schema.optional(Schema.String),
  profile: Schema.optional(BadgeProfileSchema),
});

export type BadgeResult = typeof BadgeResultSchema.Type;

export const badgeRegenerationInputFields = {
  fullName: nonBlank(200),
  oneLiner: nonBlank(30),
  linkUrl: url,
  pictureSource: Schema.optional(PictureSource),
};

export const BadgeRegenerationInput = Schema.Struct(
  badgeRegenerationInputFields,
);

export const badgeRegenerationInputFieldNames = Object.keys(
  badgeRegenerationInputFields,
);

export type BadgeRegenerationInput = typeof BadgeRegenerationInput.Type;

export const PictureUploadSchema = Schema.Struct({
  url: Schema.String,
  contentType: PictureContentType,
  size: Schema.Number,
});

export type PictureUpload = typeof PictureUploadSchema.Type;

export const PictureUploadRequestSchema = Schema.Struct({
  contentType: PictureContentType,
  size: Schema.Number.pipe(
    Schema.check(
      Schema.isBetween({ minimum: 1, maximum: maximumPictureBytes }),
    ),
  ),
});

export type PictureUploadRequest = typeof PictureUploadRequestSchema.Type;

export const PictureUploadGrantSchema = Schema.Struct({
  pathname: Schema.String,
  clientToken: Schema.String,
});

export type PictureUploadGrant = typeof PictureUploadGrantSchema.Type;

export const PictureUploadCompletionSchema = Schema.Struct({
  pathname: Schema.String,
  url: Schema.String,
});

export type PictureUploadCompletion = typeof PictureUploadCompletionSchema.Type;

export const RegistrationResultSchema = Schema.Struct({
  registration: RegistrationViewSchema,
  requirements: RegistrationRequirementsSchema,
  admission: Schema.optional(
    Schema.Struct({
      challengesMandatory: Schema.Literal(true),
      selectionBasis: Schema.Literal("challenge_rankings"),
      notice: Schema.String,
    }),
  ),
});

export type RegistrationResult = typeof RegistrationResultSchema.Type;

export const CreatedRegistrationSchema = RegistrationResultSchema;

export type CreatedRegistration = typeof CreatedRegistrationSchema.Type;

export const ApiSuccessSchema = <S extends Schema.Constraint>(data: S) =>
  Schema.Struct({
    version: Schema.Literal(1),
    ok: Schema.Literal(true),
    requestId: Schema.String,
    data,
  });
