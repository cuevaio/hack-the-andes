import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  type BrokenAgentHumanReview,
  BrokenAgentHumanReviewSchema,
  challengeCatalog,
  isChallengeOpenAt,
  type Shipment,
  ShipmentSchema,
  SlowServiceCompanionReviewSchema,
} from "@chofex/challenges-contract";
import { PowerReadingSchema } from "@chofex/challenges-contract/power-grid";
import { isSlowServiceSourceWithinLimit } from "@chofex/challenges-contract/slow-service";
import { Effect, Schema } from "effect";
import { Prompt } from "effect/unstable/cli";
import type * as PromptModule from "effect/unstable/cli/Prompt";

import { CliError, cliError } from "./errors.js";

export const defaultChallengeSlug =
  challengeCatalog
    .filter(
      (challenge) =>
        challenge.playable && isChallengeOpenAt(challenge, new Date()),
    )
    .at(-1)?.slug ?? "broken-agent";

const readStdin = async (): Promise<string> => {
  const chunks: Array<Buffer> = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
};

export const readTextFile = (path: string): Effect.Effect<string, CliError> =>
  Effect.tryPromise({
    try: async () => {
      if (path === "-") return readStdin();
      return readFile(path, "utf8");
    },
    catch: (error) =>
      cliError(
        "INVALID_INPUT_FILE",
        `Could not read ${path}: ${String(error)}`,
      ),
  });

export const javascriptSourceFromPath = (
  path: string | undefined,
  challenge: string = defaultChallengeSlug,
): Effect.Effect<{ kind: "javascript_source"; source: string }, CliError> => {
  if (!path) {
    let expectedFunction = "calculateShipping(input)";
    if (challenge === "broken-agent")
      expectedFunction = "createScheduler(dependencies)";
    if (challenge === "power-grid") expectedFunction = "calculateBill(input)";
    if (challenge === "make-it-fast") expectedFunction = "createLedger()";
    return Effect.fail(
      cliError(
        "SOURCE_REQUIRED",
        `Pass --source <file.js> with function ${expectedFunction}`,
      ),
    );
  }
  return readTextFile(path).pipe(
    Effect.flatMap((source) => {
      if (
        challenge === "make-it-fast" &&
        !isSlowServiceSourceWithinLimit(source)
      )
        return Effect.fail(
          cliError(
            "INVALID_SOURCE",
            "El source debe tener entre 1 y 32,768 bytes UTF-8.",
          ),
        );
      return Effect.succeed(source);
    }),
    Effect.map((source) => ({ kind: "javascript_source" as const, source })),
  );
};

const humanReviewRequiredDetails = {
  requiredFields: [
    "sourceDigest",
    "focus",
    "failureScenario",
    "evidence",
    "decision",
    "confidence",
    "remainingRisk",
  ],
  next: "Ask the participant to reason about the patch and provide these answers in review.json, then pass --review review.json.",
};

const slowServiceReviewRequiredDetails = {
  requiredFields: humanReviewRequiredDetails.requiredFields,
  focusValues: [
    "atomic_corrections",
    "retroactive_solvency",
    "historical_percentiles",
    "history_capacity",
    "cpu_growth",
  ],
  next: "Work with the participant to choose a failure case, inspect real evidence and record their ship or block decision in review.json. Pass --review review.json, then hand approvalUrl to the participant for browser/passkey approval of the exact source.",
};

export const brokenAgentReviewFromPath = (
  path: string | undefined,
): Effect.Effect<BrokenAgentHumanReview, CliError> => {
  if (!path) {
    return Effect.fail(
      cliError(
        "HUMAN_REVIEW_REQUIRED",
        "Broken Agent requires the participant's engineering review before an official evaluation",
        false,
        humanReviewRequiredDetails,
      ),
    );
  }
  return readTextFile(path).pipe(
    Effect.flatMap((contents) =>
      Effect.try({
        try: () => JSON.parse(contents) as unknown,
        catch: (error) =>
          cliError(
            "INVALID_REVIEW_FILE",
            `Could not parse JSON review: ${String(error)}`,
          ),
      }),
    ),
    Effect.flatMap((input) =>
      Schema.decodeUnknownEffect(BrokenAgentHumanReviewSchema, {
        onExcessProperty: "error",
      })(input).pipe(
        Effect.mapError((error) =>
          cliError("INVALID_HUMAN_REVIEW", error.message, false, {
            ...humanReviewRequiredDetails,
            issues: String(error),
          }),
        ),
      ),
    ),
  );
};

export const challengeEvaluationInput = (
  sourcePath: string | undefined,
  reviewPath: string | undefined,
  challenge: string,
) =>
  Effect.gen(function* () {
    const solution = yield* javascriptSourceFromPath(sourcePath, challenge);
    if (challenge !== "broken-agent" && challenge !== "make-it-fast")
      return solution;
    const sourceDigest = createHash("sha256")
      .update(solution.source)
      .digest("hex");
    const requiredDetails =
      challenge === "make-it-fast"
        ? slowServiceReviewRequiredDetails
        : humanReviewRequiredDetails;
    if (!reviewPath) {
      return yield* Effect.fail(
        cliError(
          "HUMAN_REVIEW_REQUIRED",
          challenge === "make-it-fast"
            ? "The Slow Service requires a source-bound companion review and participant approval before evaluation"
            : "Broken Agent requires the participant's engineering review before an official evaluation",
          false,
          { ...requiredDetails, sourceDigest },
        ),
      );
    }
    const review =
      challenge === "make-it-fast"
        ? yield* readTextFile(reviewPath).pipe(
            Effect.flatMap((contents) =>
              Effect.try({
                try: (): unknown => JSON.parse(contents),
                catch: () =>
                  cliError(
                    "INVALID_REVIEW_FILE",
                    "Could not parse JSON review",
                  ),
              }),
            ),
            Effect.flatMap((input) =>
              Schema.decodeUnknownEffect(SlowServiceCompanionReviewSchema, {
                onExcessProperty: "error",
              })(input).pipe(
                Effect.mapError((error) =>
                  cliError(
                    "INVALID_HUMAN_REVIEW",
                    error.message,
                    false,
                    slowServiceReviewRequiredDetails,
                  ),
                ),
              ),
            ),
          )
        : yield* brokenAgentReviewFromPath(reviewPath);
    if (review.sourceDigest !== sourceDigest) {
      return yield* Effect.fail(
        cliError(
          "STALE_HUMAN_REVIEW",
          "review.json does not match the current source file",
          false,
          {
            expectedSourceDigest: sourceDigest,
            reviewSourceDigest: review.sourceDigest,
            next: "Show the participant the updated evidence, obtain a fresh decision, and replace review.json.",
          },
        ),
      );
    }
    if (challenge === "make-it-fast" && review.decision === "block") {
      return yield* Effect.fail(
        cliError(
          "REVIEW_BLOCKED",
          "La decisión block no autoriza una evaluación. Revisa el código y la evidencia antes de enviarlo.",
        ),
      );
    }
    return { ...solution, review };
  });

const requiredInteger = (message: string): Prompt.Prompt<string> =>
  Prompt.text({
    message,
    validate: (value) => {
      if (value.trim() === "" || !Number.isInteger(Number(value))) {
        return Effect.fail("Must be a whole number");
      }
      return Effect.succeed(value);
    },
  });

const interactiveShipment = (): Effect.Effect<
  Shipment,
  CliError,
  PromptModule.Environment
> =>
  Prompt.run(
    Prompt.all({
      distanceKm: requiredInteger("Distance (whole km)"),
      weightKg: requiredInteger("Weight (whole kg)"),
      hour: requiredInteger("Hour (0-23)"),
      fragile: Prompt.confirm({ message: "Fragile?" }),
      express: Prompt.confirm({ message: "Express?" }),
    }),
  ).pipe(
    Effect.map((input) => ({
      distanceKm: Number(input.distanceKm),
      weightKg: Number(input.weightKg),
      hour: Number(input.hour),
      fragile: input.fragile,
      express: input.express,
    })),
    Effect.flatMap((input) =>
      Schema.decodeUnknownEffect(ShipmentSchema)(input).pipe(
        Effect.mapError((error) => cliError("VALIDATION_ERROR", error.message)),
      ),
    ),
    Effect.mapError((error) => {
      if (error instanceof CliError) return error;
      return cliError("PROMPT_CANCELLED", "Interactive input was cancelled");
    }),
  );

export const shipmentInput = (
  path: string | undefined,
  flags: {
    readonly distanceKm?: number;
    readonly weightKg?: number;
    readonly hour?: number;
    readonly fragile?: boolean;
    readonly express?: boolean;
  },
): Effect.Effect<Shipment, CliError, PromptModule.Environment> => {
  if (path) {
    return readTextFile(path).pipe(
      Effect.flatMap((contents) =>
        Effect.try({
          try: () => JSON.parse(contents) as unknown,
          catch: (error) =>
            cliError(
              "INVALID_INPUT_FILE",
              `Could not parse JSON shipment: ${String(error)}`,
            ),
        }),
      ),
      Effect.flatMap((input) =>
        Schema.decodeUnknownEffect(ShipmentSchema)(input).pipe(
          Effect.mapError((error) =>
            cliError("VALIDATION_ERROR", error.message),
          ),
        ),
      ),
    );
  }

  const hasFlags =
    flags.distanceKm !== undefined &&
    flags.weightKg !== undefined &&
    flags.hour !== undefined &&
    flags.fragile !== undefined &&
    flags.express !== undefined;
  if (hasFlags) {
    return Schema.decodeUnknownEffect(ShipmentSchema)({
      distanceKm: flags.distanceKm,
      weightKg: flags.weightKg,
      hour: flags.hour,
      fragile: flags.fragile,
      express: flags.express,
    }).pipe(
      Effect.mapError((error) => cliError("VALIDATION_ERROR", error.message)),
    );
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Effect.fail(
      cliError(
        "INPUT_REQUIRED",
        "Provide --input shipment.json or --distance, --weight, --hour, --fragile, and --express",
      ),
    );
  }
  return interactiveShipment();
};

export const powerReadingInput = (path: string | undefined) => {
  if (!path)
    return Effect.fail(
      cliError(
        "INPUT_REQUIRED",
        "Usa --input input.json con consumptionKwh, demandKw, hour, solar y business.",
      ),
    );
  return readTextFile(path).pipe(
    Effect.flatMap((contents) =>
      Effect.try({
        try: (): unknown => JSON.parse(contents),
        catch: () =>
          cliError(
            "INVALID_INPUT_FILE",
            "El archivo debe contener JSON válido",
          ),
      }),
    ),
    Effect.flatMap((input) =>
      Schema.decodeUnknownEffect(PowerReadingSchema, {
        onExcessProperty: "error",
      })(input).pipe(
        Effect.mapError((error) => cliError("VALIDATION_ERROR", error.message)),
      ),
    ),
  );
};
