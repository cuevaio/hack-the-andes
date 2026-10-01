import { describe, expect, test } from "bun:test";
import { Schema } from "effect";

import {
  AcceptedDetailsInput,
  ApplicationDraftInput,
  ApplicationInput,
  ApplicationPartId,
  acceptedDetailsSemanticRequirements,
  applicationDraftReplacementFrom,
  applicationRequirementsFor,
  applicationSemanticRequirements,
  BadgeRegenerationInput,
  CurrentUserSchema,
  campaignAttributionFromOAuthState,
  campaignAttributionHandoffFromValue,
  campaignAttributionHandoffValue,
  joinFullName,
  oauthStateWithCampaignAttribution,
  type RegistrationView,
  splitFullName,
} from "./index.js";

const application = {
  countryCode: "PE",
  fullName: " Ada Lovelace ",
  role: "Programmer",
  codeOfConductAccepted: true,
} as const;

const registrationView = (
  overrides: Partial<RegistrationView> = {},
): RegistrationView => ({
  id: "application_123",
  status: "submitted",
  countryCode: "PE",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  role: "Programmer",
  participationMode: "in_person",
  nationalIdProvided: false,
  mediaConsent: false,
  codeOfConductAccepted: true,
  privacyPolicyAccepted: true,
  submittedAt: "2026-09-01T12:00:00.000Z",
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  challenges: [],
  ...overrides,
});

describe("badge regeneration", () => {
  test("normalizes the public badge profile and accepts a picture change", () => {
    const decoded = Schema.decodeUnknownSync(BadgeRegenerationInput)({
      fullName: "  Ada Lovelace  ",
      oneLiner: "  Computing pioneer  ",
      linkUrl: "ada.dev",
      pictureSource: "github",
    });

    expect(decoded).toEqual({
      fullName: "Ada Lovelace",
      oneLiner: "Computing pioneer",
      linkUrl: "https://ada.dev",
      pictureSource: "github",
    });
  });
});

describe("campaign attribution OAuth handoff", () => {
  const handoff = {
    capturedAt: Date.UTC(2026, 8, 19, 12),
    landingId: "018f47a2-89ab-7def-8123-456789abcdef",
  };

  test("round trips a bounded landing reference through OAuth state", () => {
    const value = campaignAttributionHandoffValue(handoff);
    expect(value).toBe("018f47a2-89ab-7def-8123-456789abcdef.1789819200000");
    expect(campaignAttributionHandoffFromValue(value)).toEqual(handoff);

    const state = oauthStateWithCampaignAttribution("csrf_nonce", handoff);
    expect(campaignAttributionFromOAuthState("csrf_nonce", state)).toEqual({
      valid: true,
      handoff,
    });
  });

  test("rejects altered state and malformed landing references", () => {
    expect(
      campaignAttributionFromOAuthState(
        "csrf_nonce",
        "different.018f47a2-89ab-7def-8123-456789abcdef.1789819200000",
      ),
    ).toEqual({ valid: false });
    expect(
      campaignAttributionHandoffFromValue("not-a-uuid.123"),
    ).toBeUndefined();
    expect(
      campaignAttributionHandoffFromValue(
        "018f47a2-89ab-7def-8123-456789abcdef.1.5",
      ),
    ).toBeUndefined();
  });
});

describe("registration contract", () => {
  test("requires a real country on registration and forbids clearing it in drafts", () => {
    expect(
      Schema.decodeUnknownSync(ApplicationInput)({
        ...application,
        countryCode: "US",
      }).countryCode,
    ).toBe("US");
    for (const countryCode of [undefined, null, "", "ZZ", "Peru", "pe"]) {
      expect(() =>
        Schema.decodeUnknownSync(ApplicationInput)({
          ...application,
          countryCode,
        }),
      ).toThrow();
    }
    expect(() =>
      Schema.decodeUnknownSync(ApplicationDraftInput)({ countryCode: null }),
    ).toThrow();
    expect(
      Schema.decodeUnknownSync(ApplicationDraftInput)({ role: "Builder" }),
    ).toEqual({ role: "Builder" });
    const requirements = applicationRequirementsFor(
      registrationView({ status: "draft", countryCode: undefined }),
    );
    expect(requirements.canSubmitApplication).toBe(false);
    expect(requirements.missing).toEqual([
      { field: "countryCode", reason: "Selecciona tu país de residencia" },
    ]);
  });
  test("decodes an authenticated CLI identity", () => {
    expect(
      Schema.decodeUnknownSync(CurrentUserSchema)({
        authenticated: true,
        userId: "user_123",
        email: "ada@example.com",
        tokenType: "oauth_token",
      }),
    ).toEqual({
      authenticated: true,
      userId: "user_123",
      email: "ada@example.com",
      tokenType: "oauth_token",
    });
  });

  test("accepts optional application profile fields", () => {
    const decoded = Schema.decodeUnknownSync(ApplicationInput)({
      ...application,
      phone: "+51 999 999 999",
      githubUrl: "github.com/cuevaio",
      bio: "I build tools for developers.",
      portfolioUrl: "ada.dev",
      shippedProject: "An analytical engine simulator.",
    });
    expect(decoded.fullName).toBe("Ada Lovelace");
    expect(decoded.role).toBe("Programmer");
    expect(decoded.phone).toBe("+51 999 999 999");
    expect(decoded.githubUrl).toBe("https://github.com/cuevaio");
    expect(decoded.bio).toBe("I build tools for developers.");
    expect(decoded.portfolioUrl).toBe("https://ada.dev");
    expect(decoded.shippedProject).toBe("An analytical engine simulator.");
    expect(decoded).not.toHaveProperty("email");
    expect(decoded).not.toHaveProperty("firstName");
    expect(decoded).not.toHaveProperty("city");
  });

  test("rejects identity and event constants supplied by clients", () => {
    expect(() =>
      Schema.decodeUnknownSync(ApplicationInput, {
        onExcessProperty: "error",
      })({
        ...application,
        email: "other@example.com",
        participationMode: "remote",
      }),
    ).toThrow();
  });

  test("rejects removed application fields", () => {
    expect(() =>
      Schema.decodeUnknownSync(ApplicationInput, {
        onExcessProperty: "error",
      })({
        ...application,
        firstName: "Ada",
        lastName: "Lovelace",
        city: "Lima",
        organization: "Analytical Engines Inc.",
      }),
    ).toThrow();
  });

  test("accepts null to clear optional draft fields", () => {
    expect(
      Schema.decodeUnknownSync(ApplicationDraftInput)({
        role: null,
        phone: null,
        githubUrl: null,
        linkedInUrl: null,
        bio: null,
        portfolioUrl: null,
        shippedProject: null,
      }),
    ).toEqual({
      role: null,
      phone: null,
      githubUrl: null,
      linkedInUrl: null,
      bio: null,
      portfolioUrl: null,
      shippedProject: null,
    });
  });

  test("clears omitted optional fields when replacing a complete draft", () => {
    const input = Schema.decodeUnknownSync(ApplicationInput)(application);

    expect(applicationDraftReplacementFrom(input)).toMatchObject({
      phone: null,
      bio: null,
      portfolioUrl: null,
      shippedProject: null,
      githubUrl: null,
      linkedInUrl: null,
    });
  });

  test("splits a full name across existing given and family name columns", () => {
    expect(splitFullName("Ada Lovelace")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(splitFullName("Mary Ann Smith")).toEqual({
      firstName: "Mary Ann",
      lastName: "Smith",
    });
    expect(splitFullName("Madonna")).toEqual({
      firstName: "Madonna",
      lastName: "",
    });
    expect(joinFullName("Ada", "Lovelace")).toBe("Ada Lovelace");
    expect(joinFullName("Madonna", "")).toBe("Madonna");
  });

  test("splits a long name at a boundary that fits both columns", () => {
    const given = "A".repeat(60);
    const middle = "B".repeat(60);
    const family = "C".repeat(20);
    const fullName = `${given} ${middle} ${family}`;
    expect(splitFullName(fullName)).toEqual({
      firstName: given,
      lastName: `${middle} ${family}`,
    });
    expect(
      applicationSemanticRequirements(
        Schema.decodeUnknownSync(ApplicationInput)({
          ...application,
          fullName,
        }),
      ),
    ).toEqual([]);
  });

  test("rejects a full name that cannot fit the existing name columns", () => {
    const decoded = Schema.decodeUnknownSync(ApplicationInput)({
      ...application,
      fullName: `${"A".repeat(101)} ${"B".repeat(10)}`,
    });
    expect(applicationSemanticRequirements(decoded)).toEqual([
      {
        field: "fullName",
        reason:
          "Must split into given and family names of 100 characters or fewer",
      },
    ]);
  });

  test("does not require optional application fields", () => {
    const decoded = Schema.decodeUnknownSync(ApplicationInput)(application);
    expect(applicationSemanticRequirements(decoded)).toEqual([]);
    expect(decoded).not.toHaveProperty("bio");
    expect(decoded).not.toHaveProperty("phone");
    expect(decoded).not.toHaveProperty("portfolioUrl");
    expect(decoded).not.toHaveProperty("shippedProject");
    expect(decoded).not.toHaveProperty("githubUrl");
    expect(decoded).not.toHaveProperty("linkedInUrl");
  });

  test("requires shirt size only for in-person attendance", () => {
    const details = Schema.decodeUnknownSync(AcceptedDetailsInput)({
      fullName: "Ada Lovelace",
      phone: "+44 20 0000 0000",
      dateOfBirth: "1990-01-01",
      nationalIdNumber: "AB123456",
      emergencyContactName: "Charles Babbage",
      emergencyContactPhone: "+44 20 0000 0001",
      pictureSource: "clerk",
    });
    expect(acceptedDetailsSemanticRequirements(details, "in_person")).toEqual([
      {
        field: "shirtSize",
        reason: "Required for in-person participants",
      },
    ]);
    expect(acceptedDetailsSemanticRequirements(details, "remote")).toEqual([]);
  });

  test("accepts an optional one-line badge description during confirmation", () => {
    const details = Schema.decodeUnknownSync(AcceptedDetailsInput)({
      fullName: "Ada Lovelace",
      name: "Ada L.",
      oneLiner: "Computing pioneer",
      dateOfBirth: "1990-01-01",
      nationalIdNumber: "AB123456",
      emergencyContactName: "Charles Babbage",
      emergencyContactPhone: "+44 20 0000 0001",
      pictureSource: "clerk",
    });

    expect(details.name).toBe("Ada L.");
    expect(details.oneLiner).toBe("Computing pioneer");
    expect(details.phone).toBeUndefined();
  });

  test("requires a national ID after acceptance", () => {
    expect(() =>
      Schema.decodeUnknownSync(AcceptedDetailsInput)({
        fullName: "Ada Lovelace",
        phone: "+44 20 0000 0000",
        dateOfBirth: "1990-01-01",
        emergencyContactName: "Charles Babbage",
        emergencyContactPhone: "+44 20 0000 0001",
        pictureSource: "clerk",
      }),
    ).toThrow();
  });

  test("requires the full name shown on the participant's ID", () => {
    expect(() =>
      Schema.decodeUnknownSync(AcceptedDetailsInput)({
        phone: "+44 20 0000 0000",
        dateOfBirth: "1990-01-01",
        nationalIdNumber: "AB123456",
        emergencyContactName: "Charles Babbage",
        emergencyContactPhone: "+44 20 0000 0001",
        pictureSource: "clerk",
      }),
    ).toThrow();
  });

  test("rejects impossible and future birth dates", () => {
    const details = Schema.decodeUnknownSync(AcceptedDetailsInput)({
      fullName: "Ada Lovelace",
      phone: "+44 20 0000 0000",
      dateOfBirth: "2024-02-30",
      nationalIdNumber: "AB123456",
      emergencyContactName: "Charles Babbage",
      emergencyContactPhone: "+44 20 0000 0001",
      pictureSource: "github",
    });
    expect(acceptedDetailsSemanticRequirements(details, "remote")).toEqual([
      {
        field: "dateOfBirth",
        reason: "Must be a valid date in the past",
      },
    ]);

    const future = {
      ...details,
      dateOfBirth: "2100-01-01",
    };
    expect(acceptedDetailsSemanticRequirements(future, "remote")).toEqual([
      {
        field: "dateOfBirth",
        reason: "Must be a valid date in the past",
      },
    ]);
  });

  test("requires accepted participants to confirm a picture source", () => {
    expect(() =>
      Schema.decodeUnknownSync(AcceptedDetailsInput)({
        fullName: "Ada Lovelace",
        phone: "+44 20 0000 0000",
        dateOfBirth: "1990-01-01",
        nationalIdNumber: "AB123456",
        emergencyContactName: "Charles Babbage",
        emergencyContactPhone: "+44 20 0000 0001",
      }),
    ).toThrow();
  });

  test("keeps submitted applications in review", () => {
    for (const status of ["submitted", "under_review", "waitlisted"] as const) {
      const requirements = applicationRequirementsFor(
        registrationView({ status }),
      );
      expect(requirements.stage).toBe("review");
      expect(requirements.canSubmitNewApplication).toBe(false);
      expect(requirements.canSubmitAcceptedDetails).toBe(false);
      expect(requirements.canSaveDraft).toBe(false);
      expect(requirements.canSubmitApplication).toBe(false);
      expect(requirements.missing).toEqual([]);
    }
  });

  test("keeps published application-part identifiers", () => {
    expect(Schema.decodeUnknownSync(ApplicationPartId)("identity")).toBe(
      "identity",
    );
    expect(Schema.decodeUnknownSync(ApplicationPartId)("experience")).toBe(
      "experience",
    );
    expect(Schema.decodeUnknownSync(ApplicationPartId)("team")).toBe("team");
    expect(Schema.decodeUnknownSync(ApplicationPartId)("agreements")).toBe(
      "agreements",
    );
    expect(() =>
      Schema.decodeUnknownSync(ApplicationPartId)("profile"),
    ).toThrow();
  });

  test("treats drafts as a resumable application with required parts", () => {
    const requirements = applicationRequirementsFor(
      registrationView({
        status: "draft",
        firstName: "Ada",
        lastName: "Lovelace",
        role: undefined,
      }),
    );
    expect(requirements.stage).toBe("draft");
    expect(requirements.canSaveDraft).toBe(true);
    expect(requirements.canSubmitApplication).toBe(false);
    expect(requirements.parts.map((item) => item.id)).toEqual([
      "identity",
      "agreements",
    ]);
    expect(requirements.missing).toEqual([
      { field: "role", reason: "Required to submit" },
    ]);
  });

  test("keeps application submission separate from challenge eligibility", () => {
    const withoutChallenge = applicationRequirementsFor(
      registrationView({
        status: "draft",
        challenges: [],
      }),
    );
    expect(withoutChallenge.canSubmitApplication).toBe(true);
    expect(withoutChallenge.missing).toEqual([]);
  });

  test("keeps challenge scores from blocking application submission", () => {
    const challenge = {
      slug: "black-box" as const,
      title: "The Shipping Machine",
      theme: "Black Box",
      status: "evaluated" as const,
      open: true,
      playable: true,
      queriesUsed: 12,
      queriesLimit: 25,
      evaluationsUsed: 1,
      evaluationsLimit: 3,
      bestAccuracy: 0,
      bestExactCount: 0,
      shareCode: "7A3F",
    };
    const unsuccessfulScore = applicationRequirementsFor(
      registrationView({ status: "draft", challenges: [challenge] }),
    );
    const perfectScore = applicationRequirementsFor(
      registrationView({
        status: "draft",
        challenges: [{ ...challenge, bestAccuracy: 1, bestExactCount: 1_000 }],
      }),
    );
    expect(unsuccessfulScore.canSubmitApplication).toBe(true);
    expect(perfectScore.canSubmitApplication).toBe(true);
    expect(unsuccessfulScore.stage).toBe("draft");
    expect(perfectScore.stage).toBe("draft");
  });

  test("allows a new application after rejection or withdrawal", () => {
    const rejected = applicationRequirementsFor(
      registrationView({
        status: "rejected",
        rejectionReason: "At capacity",
      }),
    );
    expect(rejected.stage).toBe("rejected");
    expect(rejected.canSubmitNewApplication).toBe(true);
    expect(rejected.canSubmitAcceptedDetails).toBe(false);
    expect(rejected.rejectionReason).toBe("At capacity");

    const withdrawn = applicationRequirementsFor(
      registrationView({ status: "withdrawn" }),
    );
    expect(withdrawn.stage).toBe("review");
    expect(withdrawn.canSubmitNewApplication).toBe(true);
    expect(withdrawn.canSubmitAcceptedDetails).toBe(false);
  });

  test("requires a completion marker and every acceptance field", () => {
    const completed = registrationView({
      status: "accepted",
      fullName: "Ada Lovelace",
      phone: "+51 999 999 999",
      dateOfBirth: "1990-01-01",
      nationalIdProvided: true,
      shirtSize: "m",
      emergencyContactName: "Grace Hopper",
      emergencyContactPhone: "+1 555 0100",
      pictureSource: "clerk",
      pictureUrl: "https://images.example/ada.jpg",
      acceptanceDetailsCompletedAt: "2026-09-02T12:00:00.000Z",
    });

    const completeRequirements = applicationRequirementsFor(completed);
    expect(completeRequirements.stage).toBe("complete");
    expect(completeRequirements.canSubmitNewApplication).toBe(false);
    expect(completeRequirements.canSubmitAcceptedDetails).toBe(true);
    expect(completeRequirements.missing).toEqual([]);
    expect(completeRequirements.parts).toEqual([]);

    const withoutMarker = {
      ...completed,
      acceptanceDetailsCompletedAt: undefined,
    };
    expect(applicationRequirementsFor(withoutMarker).stage).toBe("accepted");

    const malformedCompletion = {
      ...completed,
      shirtSize: undefined,
    };
    const malformed = applicationRequirementsFor(malformedCompletion);
    expect(malformed.stage).toBe("accepted");
    expect(malformed.missing).toEqual([
      {
        field: "shirtSize",
        reason: "Required for in-person participants",
      },
    ]);
  });

  test("allows attendance confirmation without a WhatsApp phone", () => {
    const requirements = applicationRequirementsFor(
      registrationView({
        status: "accepted",
        applicationPhone: "+51 999 999 999",
        fullName: "Ada Lovelace",
        dateOfBirth: "1990-01-01",
        nationalIdProvided: true,
        shirtSize: "m",
        emergencyContactName: "Grace Hopper",
        emergencyContactPhone: "+1 555 0100",
        pictureSource: "clerk",
        pictureUrl: "https://images.example/ada.jpg",
        acceptanceDetailsCompletedAt: "2026-09-02T12:00:00.000Z",
      }),
    );

    expect(requirements.stage).toBe("complete");
    expect(requirements.missing).toEqual([]);
  });

  test("does not require a shirt size for remote acceptance", () => {
    const completed = registrationView({
      status: "accepted",
      participationMode: "remote",
      fullName: "Ada Lovelace",
      phone: "+51 999 999 999",
      dateOfBirth: "1990-01-01",
      nationalIdProvided: true,
      emergencyContactName: "Grace Hopper",
      emergencyContactPhone: "+1 555 0100",
      pictureSource: "github",
      pictureUrl: "https://github.com/ada.png",
      acceptanceDetailsCompletedAt: "2026-09-02T12:00:00.000Z",
    });

    expect(applicationRequirementsFor(completed).stage).toBe("complete");
  });
});
