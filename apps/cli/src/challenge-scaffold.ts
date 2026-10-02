import { mkdir, writeFile } from "node:fs/promises";
import { challengeBySlug } from "@chofex/challenges-contract";
import {
  brokenAgentPackageJson,
  brokenAgentPublicTestSource,
  brokenAgentReadme,
  brokenAgentScaffoldDirectory,
  brokenAgentSolutionPath,
  brokenAgentStarterSource,
} from "@chofex/challenges-contract/broken-agent";
import {
  slowServiceChallengeSlug,
  slowServiceChallengeVersion,
  slowServiceScaffoldDirectory,
} from "@chofex/challenges-contract/slow-service";
import { slowServiceToolkit } from "@chofex/challenges-contract/slow-service/toolkit";
import { Effect, Predicate } from "effect";

import { type CliError, cliError } from "./errors.js";

const solutionPath = "shipping.js";

const starterSource = `/**
 * The Shipping Machine
 *
 * Replace an undocumented service that calculates delivery prices.
 * Use your notebook observations to infer the hidden rules.
 *
 * input.distanceKm  number  0.1–2000
 * input.weightKg    number  0.1–500
 * input.hour        integer 0–23
 * input.fragile     boolean
 * input.express     boolean
 *
 * Return one finite number: your predicted shipping price.
 */
function calculateShipping(input) {
  // TODO: replace this baseline with the rules you discover.
  return 0;
}
`;

export interface ChallengeScaffoldResult {
  readonly challenge: string;
  readonly path: string;
  readonly status: "created" | "exists";
}

export const createChallengeScaffold = Effect.fn("createChallengeScaffold")(
  function* (
    challengeSlug = "black-box",
  ): Effect.fn.Return<ChallengeScaffoldResult, CliError> {
    const challenge = challengeBySlug(challengeSlug);
    if (!challenge?.playable) {
      return yield* Effect.fail(
        cliError(
          "CHALLENGE_NOT_AVAILABLE",
          `Challenge ${challengeSlug} is not available`,
        ),
      );
    }

    if (challengeSlug === slowServiceChallengeSlug) {
      if (
        slowServiceToolkit.kind !== "ready" ||
        slowServiceToolkit.version !== slowServiceChallengeVersion
      )
        return yield* Effect.fail(
          cliError(
            "SLOW_SERVICE_TOOLKIT_NOT_READY",
            `El toolkit de ${slowServiceChallengeVersion} todavía no está listo. El challenge sigue cerrado.`,
            true,
          ),
        );
      const files = slowServiceToolkit.files;
      const directory = slowServiceScaffoldDirectory;
      const status = yield* Effect.tryPromise({
        try: async () => {
          await mkdir(directory);
          await mkdir(`${directory}/.kit`);
          await Promise.all(
            Object.entries(files).map(([name, contents]) =>
              writeFile(`${directory}/${name}`, contents, "utf8"),
            ),
          );
          return "created" as const;
        },
        catch: (error) => error,
      }).pipe(
        Effect.catch((error) => {
          if (Predicate.hasProperty(error, "code") && error.code === "EEXIST")
            return Effect.succeed("exists" as const);
          return Effect.fail(
            cliError(
              "SCAFFOLD_FAILED",
              `Could not create ${directory}: ${String(error)}`,
            ),
          );
        }),
      );
      return { challenge: challengeSlug, path: directory, status };
    }

    if (challengeSlug === "broken-agent") {
      const status = yield* Effect.tryPromise({
        try: async () => {
          await mkdir(brokenAgentScaffoldDirectory);
          await Promise.all([
            writeFile(
              brokenAgentSolutionPath,
              brokenAgentStarterSource,
              "utf8",
            ),
            writeFile(
              `${brokenAgentScaffoldDirectory}/scheduler.test.js`,
              brokenAgentPublicTestSource,
              "utf8",
            ),
            writeFile(
              `${brokenAgentScaffoldDirectory}/README.md`,
              brokenAgentReadme,
              "utf8",
            ),
            writeFile(
              `${brokenAgentScaffoldDirectory}/package.json`,
              brokenAgentPackageJson,
              "utf8",
            ),
          ]);
          return "created" as const;
        },
        catch: (error) => error,
      }).pipe(
        Effect.catch((error) => {
          if (Predicate.hasProperty(error, "code") && error.code === "EEXIST") {
            return Effect.succeed("exists" as const);
          }
          return Effect.fail(
            cliError(
              "SCAFFOLD_FAILED",
              `Could not create ${brokenAgentScaffoldDirectory}: ${String(error)}`,
            ),
          );
        }),
      );

      return {
        challenge: challengeSlug,
        path: brokenAgentScaffoldDirectory,
        status,
      };
    }

    const status = yield* Effect.tryPromise({
      try: async () => {
        await writeFile(solutionPath, starterSource, {
          encoding: "utf8",
          flag: "wx",
        });
        return "created" as const;
      },
      catch: (error) => error,
    }).pipe(
      Effect.catch((error) => {
        if (Predicate.hasProperty(error, "code") && error.code === "EEXIST") {
          return Effect.succeed("exists" as const);
        }
        return Effect.fail(
          cliError(
            "SCAFFOLD_FAILED",
            `Could not create ${solutionPath}: ${String(error)}`,
          ),
        );
      }),
    );

    return { challenge: challengeSlug, path: solutionPath, status };
  },
);
