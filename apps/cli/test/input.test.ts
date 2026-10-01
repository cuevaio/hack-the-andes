import { describe, expect, test } from "bun:test";
import { NodeServices } from "@effect/platform-node";
import { Effect, Option, Queue } from "effect";
import type * as Cause from "effect/Cause";
import * as Terminal from "effect/Terminal";

import {
  applicationDefaultsFromRegistration,
  countryPrompt,
  dateOfBirthPrompt,
  normalizeDraftFields,
  publicDocumentUrl,
  selectCountry,
} from "../src/input.js";

const input = (value: string, name = value): Terminal.UserInput => ({
  input: Option.some(value),
  key: { name, ctrl: false, meta: false, shift: false },
});

describe("CLI registration input", () => {
  test("searches countries by name and keeps a saved country without prompting", async () => {
    const program = Effect.gen(function* () {
      const inputs = yield* Queue.make<Terminal.UserInput, Cause.Done>();
      yield* Queue.offerAll(inputs, [input("Colombia"), input("\r", "return")]);
      const terminal = Terminal.make({
        columns: Effect.succeed(120),
        rows: Effect.succeed(40),
        readInput: Effect.succeed(inputs),
        readLine: Effect.never,
        display: () => Effect.void,
      });
      return yield* countryPrompt().pipe(
        Effect.provideService(Terminal.Terminal, terminal),
      );
    }).pipe(Effect.provide(NodeServices.layer));
    expect(await Effect.runPromise(program)).toBe("CO");
    expect(
      await Effect.runPromise(
        selectCountry("US").pipe(Effect.provide(NodeServices.layer)),
      ),
    ).toBe("US");
  });
  test("reuses application fields from a previous registration", () => {
    const defaults = applicationDefaultsFromRegistration({
      id: "registration-123",
      status: "rejected",
      countryCode: "CO",
      firstName: "Anthony",
      lastName: "Cueva",
      email: "hi@cueva.io",
      applicationPhone: "+51 999 999 999",
      role: "Builder",
      bio: "I build developer tools.",
      portfolioUrl: "https://cueva.io",
      shippedProject: "A collaborative coding environment.",
      githubUrl: "https://github.com/cuevaio",
      linkedInUrl: "https://linkedin.com/in/cuevaio",
      codeOfConductAccepted: true,
      privacyPolicyAccepted: true,
      nationalIdProvided: false,
      mediaConsent: true,
      participationMode: "in_person",
      rejectionReason: "Clarify the project scope.",
      submittedAt: "2026-09-09T00:00:00.000Z",
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      challenges: [],
    });

    expect(defaults).toEqual({
      countryCode: "CO",
      fullName: "Anthony Cueva",
      phone: "+51 999 999 999",
      role: "Builder",
      bio: "I build developer tools.",
      portfolioUrl: "https://cueva.io",
      shippedProject: "A collaborative coding environment.",
      githubUrl: "https://github.com/cuevaio",
      linkedInUrl: "https://linkedin.com/in/cuevaio",
      codeOfConductAccepted: true,
    });
  });

  test("does not pre-accept terms that are still missing", () => {
    const defaults = applicationDefaultsFromRegistration({
      id: "registration-123",
      status: "draft",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      participationMode: "in_person",
      nationalIdProvided: false,
      mediaConsent: false,
      codeOfConductAccepted: false,
      privacyPolicyAccepted: false,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      challenges: [],
    });

    expect(defaults.codeOfConductAccepted).toBeUndefined();
  });

  test("builds public policy links from API URLs with or without a slash", () => {
    expect(publicDocumentUrl("https://apply.chofex.com", "/terms")).toBe(
      "https://apply.chofex.com/terms",
    );
    expect(publicDocumentUrl("https://apply.chofex.com/", "/privacy")).toBe(
      "https://apply.chofex.com/privacy",
    );
  });

  test("sends explicit nulls when optional draft fields are cleared", () => {
    expect(
      normalizeDraftFields({
        githubUrl: "",
        linkedInUrl: "",
        role: undefined,
      }),
    ).toEqual({
      githubUrl: null,
      linkedInUrl: null,
    });
  });

  test("rejects an invalid date of birth before advancing", async () => {
    const output: Array<string> = [];
    const program = Effect.gen(function* () {
      const inputs = yield* Queue.make<Terminal.UserInput, Cause.Done>();
      yield* Queue.offerAll(inputs, [
        input("32"),
        input("\r", "return"),
        input("\b", "backspace"),
        input("\b", "backspace"),
        input("1990-01-01"),
        input("\r", "return"),
      ]);
      const terminal = Terminal.make({
        columns: Effect.succeed(120),
        rows: Effect.succeed(40),
        readInput: Effect.succeed(inputs),
        readLine: Effect.never,
        display: (text) => Effect.sync(() => output.push(text)),
      });

      return yield* dateOfBirthPrompt().pipe(
        Effect.provideService(Terminal.Terminal, terminal),
      );
    }).pipe(Effect.provide(NodeServices.layer));

    expect(await Effect.runPromise(program)).toBe("1990-01-01");
    expect(output.join("")).toContain("Must use YYYY-MM-DD format");
  });
});
