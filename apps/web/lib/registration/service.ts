import type { ParticipantChallengeProgress } from "@chofex/challenges-contract";
import { challengeAdmissionNotice } from "@chofex/challenges-contract";
import { db } from "@chofex/db";
import { and, desc, eq, sql } from "@chofex/db/orm";
import {
  acceptanceDetails,
  applications,
  participantBadges,
  participants,
} from "@chofex/db/schema";
import {
  AcceptedDetailsInput,
  ApplicationDraftInput,
  ApplicationInput,
  acceptedDetailsSemanticRequirements,
  applicationDraftReplacementFrom,
  applicationRequirementsFor,
  applicationSemanticRequirements,
  type CreatedRegistration,
  fullNameColumnRequirements,
  hackathonCountryCode,
  hackathonParticipationMode,
  PictureSource,
  type RegistrationResult,
  type RegistrationView,
  splitFullName,
} from "@chofex/registration-contract";
import { DateTime, Schema } from "effect";

import { challengeProgressForParticipant } from "../challenges/service";
import { badgeOneLinerFor } from "../credential/profile";
import { isUniqueViolation } from "../db-errors";
import { HttpError } from "./http";
import { participantIdFor } from "./participants";
import { confirmedPictureUrl } from "./pictures";
import { encryptSensitiveValue } from "./sensitive";

type ApplicationRecord = typeof applications.$inferSelect;
type AcceptanceDetailsRecord = typeof acceptanceDetails.$inferSelect;

interface RegistrationIdentity {
  readonly clerkUserId: string;
  readonly email: string;
  readonly name?: string;
  readonly clerkPictureUrl?: string;
}

const optional = <A>(value: A | null | undefined): A | undefined =>
  value ?? undefined;
const instantString = (value: Date): string => value.toISOString();
const dateString = (value: Date | string): string => {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

const optionalDateString = (
  value: Date | string | null | undefined,
): string | undefined => {
  if (!value) return undefined;
  return dateString(value);
};

const optionalInstantString = (
  value: Date | null | undefined,
): string | undefined => {
  if (!value) return undefined;
  return instantString(value);
};

const parseInput = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown,
): S["Type"] => {
  try {
    return Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(
      input,
    );
  } catch (error) {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Input validation failed",
      false,
      {
        issues: String(error),
      },
    );
  }
};

const assertNoRequirements = (
  requirements: ReadonlyArray<{
    readonly field: string;
    readonly reason: string;
  }>,
): void => {
  if (requirements.length > 0) {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Input validation failed",
      false,
      { issues: requirements },
    );
  }
};

const encryptNationalId = (value: string): string => {
  const encryptionKey = process.env.PARTICIPANT_DATA_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new HttpError(
      500,
      "ENCRYPTION_NOT_CONFIGURED",
      "Sensitive participant data encryption is not configured",
    );
  }
  try {
    return encryptSensitiveValue(value, encryptionKey);
  } catch {
    throw new HttpError(
      500,
      "ENCRYPTION_NOT_CONFIGURED",
      "Sensitive participant data encryption is not configured correctly",
    );
  }
};

const toView = (
  application: ApplicationRecord,
  details: AcceptanceDetailsRecord | undefined,
  challenges: ReadonlyArray<ParticipantChallengeProgress>,
): RegistrationView => ({
  id: application.id,
  status: application.status,
  firstName: application.firstName ?? "",
  lastName: application.lastName ?? "",
  email: application.email ?? "",
  applicationPhone: optional(application.phone),
  fullName: optional(details?.fullName),
  phone: optional(details?.phone ?? application.phone),
  dateOfBirth: optionalDateString(details?.dateOfBirth),
  pronouns: optional(application.pronouns),
  countryCode: optional(application.countryCode),
  city: optional(application.city),
  participationMode: application.participationMode ?? "in_person",
  organization: optional(application.organization),
  role: optional(application.role),
  fieldOfStudy: optional(application.fieldOfStudy),
  graduationYear: optional(application.graduationYear),
  shippedProject: optional(application.shippedProject),
  hackathonProject: optional(application.hackathonProject),
  bio: optional(application.bio),
  githubUrl: optional(application.githubUrl),
  linkedInUrl: optional(application.linkedInUrl),
  portfolioUrl: optional(application.portfolioUrl),
  teamPreference: optional(application.teamPreference),
  teamName: optional(application.teamName),
  shirtSize: optional(details?.shirtSize),
  nationalIdProvided: Boolean(details?.nationalIdNumber),
  dietaryRestrictions: optional(details?.dietaryRestrictions),
  accessibilityNeeds: optional(details?.accessibilityNeeds),
  emergencyContactName: optional(details?.emergencyContactName),
  emergencyContactPhone: optional(details?.emergencyContactPhone),
  mediaConsent: details?.mediaConsent ?? application.mediaConsent,
  pictureSource: optional(application.pictureSource),
  pictureUrl: optional(application.pictureUrl),
  rejectionReason: optional(application.rejectionReason),
  codeOfConductAccepted: Boolean(application.codeOfConductAcceptedAt),
  privacyPolicyAccepted: Boolean(application.privacyPolicyAcceptedAt),
  submittedAt: optionalInstantString(application.submittedAt),
  acceptanceDetailsCompletedAt: optionalInstantString(details?.completedAt),
  createdAt: instantString(application.createdAt),
  updatedAt: instantString(details?.updatedAt ?? application.updatedAt),
  challenges: [...challenges],
});

const resultFor = async (
  application: ApplicationRecord,
  details?: AcceptanceDetailsRecord,
): Promise<RegistrationResult> => {
  const challenges = await challengeProgressForParticipant(
    application.participantId,
  );
  const registration = toView(application, details, challenges);
  return {
    registration,
    requirements: applicationRequirementsFor(registration),
    admission: {
      challengesMandatory: true,
      selectionBasis: "challenge_rankings",
      notice: challengeAdmissionNotice,
    },
  };
};

type DraftColumns = Partial<typeof applications.$inferInsert>;

const draftColumnsFrom = (
  input: ApplicationDraftInput,
  identity: RegistrationIdentity,
  now: Date,
): DraftColumns => {
  const values: DraftColumns = {
    email: identity.email,
    countryCode: hackathonCountryCode,
    participationMode: hackathonParticipationMode,
    pronouns: null,
    city: null,
    organization: null,
    fieldOfStudy: null,
    graduationYear: null,
    hackathonProject: null,
    teamPreference: null,
    teamName: null,
    mediaConsent: false,
    updatedAt: now,
  };
  if (input.fullName !== undefined) {
    const name = splitFullName(input.fullName);
    values.firstName = name.firstName;
    values.lastName = name.lastName;
  }
  if (input.role !== undefined) values.role = input.role;
  if (input.phone !== undefined) values.phone = input.phone;
  if (input.bio !== undefined) values.bio = input.bio;
  if (input.portfolioUrl !== undefined) {
    values.portfolioUrl = input.portfolioUrl;
  }
  if (input.shippedProject !== undefined) {
    values.shippedProject = input.shippedProject;
  }
  if (input.githubUrl !== undefined) values.githubUrl = input.githubUrl;
  if (input.linkedInUrl !== undefined) values.linkedInUrl = input.linkedInUrl;
  if (input.codeOfConductAccepted === true) {
    values.codeOfConductAcceptedAt = now;
    values.privacyPolicyAcceptedAt = now;
  } else if (input.codeOfConductAccepted === false) {
    values.codeOfConductAcceptedAt = null;
    values.privacyPolicyAcceptedAt = null;
  }
  return values;
};

const latestApplicationRecord = async (
  clerkUserId: string,
): Promise<
  | {
      application: ApplicationRecord;
      details?: AcceptanceDetailsRecord;
      participantName?: string;
    }
  | undefined
> => {
  const [record] = await db
    .select({
      application: applications,
      details: acceptanceDetails,
      participantName: participants.name,
    })
    .from(participants)
    .innerJoin(applications, eq(applications.participantId, participants.id))
    .leftJoin(
      acceptanceDetails,
      eq(acceptanceDetails.applicationId, applications.id),
    )
    .where(eq(participants.clerkUserId, clerkUserId))
    .orderBy(desc(applications.createdAt))
    .limit(1);
  if (!record) return undefined;
  return {
    application: record.application,
    details: record.details ?? undefined,
    participantName: optional(record.participantName),
  };
};

export const saveRegistrationDraft = async (
  identity: RegistrationIdentity,
  rawInput: unknown,
): Promise<RegistrationResult> => {
  const input = parseInput(ApplicationDraftInput, rawInput);
  if (input.fullName !== undefined) {
    assertNoRequirements(fullNameColumnRequirements(input.fullName));
  }
  const participantId = await participantIdFor(
    identity.clerkUserId,
    identity.name,
  );
  const now = new Date();
  const columns = draftColumnsFrom(input, identity, now);
  const current = await latestApplicationRecord(identity.clerkUserId);

  if (
    current &&
    current.application.status !== "draft" &&
    current.application.status !== "rejected" &&
    current.application.status !== "withdrawn"
  ) {
    throw new HttpError(
      409,
      "ACTIVE_APPLICATION_EXISTS",
      "You already have an active hackathon application",
      false,
      { currentStatus: current.application.status },
    );
  }

  if (current?.application.status === "draft") {
    const [application] = await db
      .update(applications)
      .set(columns)
      .where(
        and(
          eq(applications.id, current.application.id),
          eq(applications.status, "draft"),
        ),
      )
      .returning();
    if (!application) {
      throw new HttpError(
        409,
        "APPLICATION_ALREADY_SUBMITTED",
        "The application was submitted while this draft was being saved",
      );
    }
    return resultFor(application, current.details);
  }

  try {
    const [application] = await db
      .insert(applications)
      .values({
        participantId,
        status: "draft",
        mediaConsent: false,
        ...columns,
      })
      .returning();
    if (!application)
      throw new Error("Application draft insert returned no row");
    return resultFor(application);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(
        409,
        "ACTIVE_APPLICATION_EXISTS",
        "You already have an active hackathon application",
      );
    }
    throw error;
  }
};

export const submitRegistration = async (
  identity: RegistrationIdentity,
): Promise<CreatedRegistration> => {
  const current = await latestApplicationRecord(identity.clerkUserId);
  if (!current) {
    throw new HttpError(
      404,
      "REGISTRATION_NOT_FOUND",
      "Save an application draft before submitting",
    );
  }
  if (current.application.status !== "draft") {
    throw new HttpError(
      409,
      "ACTIVE_APPLICATION_EXISTS",
      "You already have an active hackathon application",
      false,
      { currentStatus: current.application.status },
    );
  }

  const now = new Date();
  const [application] = await db
    .update(applications)
    .set({
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(applications.id, current.application.id),
        eq(applications.status, "draft"),
        sql`${applications.firstName} is not null`,
        sql`${applications.role} is not null`,
        sql`${applications.codeOfConductAcceptedAt} is not null`,
      ),
    )
    .returning();
  if (!application) {
    const latest = await latestApplicationRecord(identity.clerkUserId);
    if (
      latest?.application.id === current.application.id &&
      latest.application.status === "draft"
    ) {
      const result = await resultFor(latest.application, latest.details);
      if (!result.requirements.canSubmitApplication) {
        throw new HttpError(
          422,
          "APPLICATION_INCOMPLETE",
          "Complete every application field and agreement before submitting",
          false,
          {
            missing: result.requirements.missing,
            parts: result.requirements.parts,
          },
        );
      }
      throw new HttpError(
        409,
        "APPLICATION_DRAFT_CHANGED",
        "The application changed while it was being submitted; review and submit it again",
      );
    }
    throw new HttpError(
      409,
      "APPLICATION_ALREADY_SUBMITTED",
      "The application was already submitted",
    );
  }
  return resultFor(application, current.details);
};

export const createRegistration = async (
  identity: RegistrationIdentity,
  rawInput: unknown,
): Promise<CreatedRegistration> => {
  const input = parseInput(ApplicationInput, rawInput);
  assertNoRequirements(applicationSemanticRequirements(input));
  const draft = await saveRegistrationDraft(
    identity,
    applicationDraftReplacementFrom(input),
  );
  if (draft.requirements.canSubmitApplication) {
    return submitRegistration(identity);
  }
  return draft;
};

const latestApplicationFor = async (
  clerkUserId: string,
): Promise<{
  application: ApplicationRecord;
  details?: AcceptanceDetailsRecord;
  participantName?: string;
}> => {
  const current = await latestApplicationRecord(clerkUserId);
  if (!current) {
    throw new HttpError(
      404,
      "REGISTRATION_NOT_FOUND",
      "Registration not found",
    );
  }
  return current;
};

export const getRegistration = async (
  clerkUserId: string,
): Promise<RegistrationResult> => {
  const current = await latestApplicationFor(clerkUserId);
  return resultFor(current.application, current.details);
};

export const submitAcceptedDetails = async (
  identity: RegistrationIdentity,
  rawInput: unknown,
): Promise<RegistrationResult> => {
  const input = parseInput(AcceptedDetailsInput, rawInput);
  const current = await latestApplicationFor(identity.clerkUserId);
  if (current.application.status !== "accepted") {
    throw new HttpError(
      409,
      "INVALID_APPLICATION_STATE",
      "Acceptance details can only be submitted after acceptance",
      false,
      { currentStatus: current.application.status },
    );
  }
  if (!current.application.participationMode) {
    throw new HttpError(
      409,
      "INCOMPLETE_APPLICATION",
      "Participation mode is missing",
    );
  }
  assertNoRequirements(
    acceptedDetailsSemanticRequirements(
      input,
      current.application.participationMode,
    ),
  );

  const [currentBadge] = await db
    .select({
      customPictureUrl: participantBadges.customPictureUrl,
      oneLiner: participantBadges.oneLiner,
    })
    .from(participantBadges)
    .where(eq(participantBadges.applicationId, current.application.id))
    .limit(1);
  const uploadedPictureUrl =
    currentBadge?.customPictureUrl ?? current.application.customPictureUrl;
  const pictureUrl = confirmedPictureUrl(input.pictureSource, {
    clerkPictureUrl: identity.clerkPictureUrl,
    githubUrl: current.application.githubUrl,
    uploadedPictureUrl,
  });

  const values = {
    fullName: input.fullName,
    phone: input.phone ?? null,
    dateOfBirth: DateTime.toDateUtc(
      DateTime.makeUnsafe(`${input.dateOfBirth}T00:00:00.000Z`),
    ),
    nationalIdNumber: encryptNationalId(input.nationalIdNumber),
    shirtSize: optional(input.shirtSize),
    dietaryRestrictions: optional(input.dietaryRestrictions),
    accessibilityNeeds: optional(input.accessibilityNeeds),
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone,
    mediaConsent: input.mediaConsent ?? current.application.mediaConsent,
    completedAt: new Date(),
  };
  const detailsUpdate = db
    .insert(acceptanceDetails)
    .values({ applicationId: current.application.id, ...values })
    .onConflictDoUpdate({
      target: acceptanceDetails.applicationId,
      set: values,
    })
    .returning();
  const oneLiner =
    input.oneLiner ??
    currentBadge?.oneLiner ??
    badgeOneLinerFor(current.application.role);
  const name =
    input.name ??
    current.participantName ??
    identity.name ??
    [current.application.firstName, current.application.lastName]
      .filter(Boolean)
      .join(" ");
  const badgeUpdate = db
    .insert(participantBadges)
    .values({
      applicationId: current.application.id,
      status: "pending",
      generationId: null,
      triggerRunId: null,
      oneLiner,
      pictureSource: input.pictureSource,
      pictureUrl,
    })
    .onConflictDoUpdate({
      target: participantBadges.applicationId,
      set: {
        status: "pending",
        generationId: null,
        triggerRunId: null,
        oneLiner,
        pictureSource: input.pictureSource,
        pictureUrl,
        error: null,
        updatedAt: new Date(),
      },
    })
    .returning();
  const participantUpdate = db
    .update(participants)
    .set({ name, updatedAt: new Date() })
    .where(eq(participants.id, current.application.participantId))
    .returning();
  if (current.details?.completedAt) {
    const [participantRows, badgeRows, detailsRows] = await db.batch([
      participantUpdate,
      badgeUpdate,
      detailsUpdate,
    ]);
    const [participant] = participantRows;
    const [badge] = badgeRows;
    const [details] = detailsRows;
    if (!participant)
      throw new Error("Participant name update returned no row");
    if (!badge) throw new Error("Badge profile update returned no row");
    if (!details) throw new Error("Acceptance details update returned no row");
    return resultFor(current.application, details);
  }

  const applicationUpdate = db
    .update(applications)
    .set({
      pictureSource: input.pictureSource,
      pictureUrl,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, current.application.id))
    .returning();
  const [applicationRows, participantRows, badgeRows, detailsRows] =
    await db.batch([
      applicationUpdate,
      participantUpdate,
      badgeUpdate,
      detailsUpdate,
    ]);
  const [application] = applicationRows;
  const [participant] = participantRows;
  const [badge] = badgeRows;
  const [details] = detailsRows;
  if (!application)
    throw new Error("Application picture update returned no row");
  if (!participant) throw new Error("Participant name update returned no row");
  if (!badge) throw new Error("Badge profile update returned no row");
  if (!details) throw new Error("Acceptance details update returned no row");
  return resultFor(application, details);
};

/**
 * Changes which picture a confirmed participant's badge carries.
 *
 * Narrow on purpose. Confirming attendance is a one-time submission of
 * private details — a date of birth, a national id, an emergency contact
 * — and re-sending all of it to swap a photograph would re-validate and
 * rewrite data the change does not touch. The selection is therefore
 * stored on the badge profile rather than on the historical application.
 *
 * It is the step the web picker was missing: uploading a picture writes
 * `customPictureUrl` on the badge profile, and only a selection turns
 * that into the `pictureUrl` the card draws.
 *
 * Refuses anybody who has not confirmed attendance yet, because for them
 * `andes confirm` is the flow and it sets this as part of a larger
 * whole.
 */
export const changePictureSource = async (
  identity: RegistrationIdentity,
  rawSource: unknown,
): Promise<RegistrationResult> => {
  const pictureSource = parseInput(PictureSource, rawSource);
  const current = await latestApplicationRecord(identity.clerkUserId);
  if (!current) {
    throw new HttpError(404, "APPLICATION_NOT_FOUND", "No application found");
  }
  if (current.application.status !== "accepted") {
    throw new HttpError(
      409,
      "INVALID_APPLICATION_STATE",
      "Only an accepted participant can change their badge picture",
    );
  }
  if (!current.details?.completedAt) {
    throw new HttpError(
      409,
      "ATTENDANCE_NOT_CONFIRMED",
      "Confirm your attendance before changing your picture",
    );
  }

  const [badge] = await db
    .select({ customPictureUrl: participantBadges.customPictureUrl })
    .from(participantBadges)
    .where(eq(participantBadges.applicationId, current.application.id))
    .limit(1);
  const pictureUrl = confirmedPictureUrl(pictureSource, {
    clerkPictureUrl: identity.clerkPictureUrl,
    githubUrl: current.application.githubUrl,
    uploadedPictureUrl: badge?.customPictureUrl,
  });

  await db
    .insert(participantBadges)
    .values({
      applicationId: current.application.id,
      status: "pending",
      generationId: null,
      triggerRunId: null,
      pictureSource,
      pictureUrl,
    })
    .onConflictDoUpdate({
      target: participantBadges.applicationId,
      set: {
        pictureSource,
        pictureUrl,
        status: "pending",
        generationId: null,
        triggerRunId: null,
        error: null,
        updatedAt: new Date(),
      },
    });

  return await getRegistration(identity.clerkUserId);
};
