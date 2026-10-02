import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acceptedDetailsInputFieldNames,
  applicationInputFieldNames,
} from "@chofex/registration-contract";

const cliDirectory = new URL("../", import.meta.url).pathname;
const cliEntry = new URL("../src/index.ts", import.meta.url).pathname;

const runCliFrom = async (
  cwd: string,
  ...arguments_: ReadonlyArray<string>
) => {
  const child = Bun.spawn([process.execPath, cliEntry, ...arguments_], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
};

const runCli = (...arguments_: ReadonlyArray<string>) =>
  runCliFrom(cliDirectory, ...arguments_);

describe("CLI JSON mode", () => {
  test("selects a missing country for an existing application and reports locked-country errors", async () => {
    let countryCode: string | undefined;
    let writes = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        if (request.method === "PUT") {
          expect(new URL(request.url).pathname).toBe(
            "/api/v1/registration/country",
          );
          const body = await request.json();
          if (countryCode && countryCode !== body.countryCode) {
            return Response.json(
              {
                version: 1,
                ok: false,
                requestId: "country-lock",
                error: {
                  code: "COUNTRY_ALREADY_SET",
                  message: "Solo el equipo puede corregir tu país.",
                  retryable: false,
                },
              },
              { status: 409 },
            );
          }
          countryCode = body.countryCode;
          writes++;
        }
        return Response.json({
          version: 1,
          ok: true,
          requestId: "country-result",
          data: {
            registration: {
              id: "existing",
              status: "submitted",
              firstName: "Ada",
              lastName: "Lovelace",
              email: "ada@example.com",
              countryCode,
              participationMode: "in_person",
              nationalIdProvided: false,
              mediaConsent: false,
              codeOfConductAccepted: true,
              privacyPolicyAccepted: true,
              createdAt: "2026-09-01T00:00:00.000Z",
              updatedAt: "2026-09-01T00:00:00.000Z",
              challenges: [],
            },
            requirements: {
              stage: "review",
              canSubmitNewApplication: false,
              canSubmitAcceptedDetails: false,
              canSaveDraft: false,
              canSubmitApplication: false,
              parts: [],
              missing: [],
            },
          },
        });
      },
    });
    const runCountry = (...args: string[]) =>
      runCli(
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "--output",
        "json",
        "country",
        ...args,
      );
    try {
      const missing = await runCountry();
      expect(JSON.parse(missing.stdout).error.code).toBe("INPUT_REQUIRED");
      const selected = await runCountry("--code", "CO");
      expect(selected.exitCode).toBe(0);
      expect(selected.stdout.trim().split("\n")).toHaveLength(1);
      expect(JSON.parse(selected.stdout).data.registration.countryCode).toBe(
        "CO",
      );
      expect(selected.stderr).toContain("debes cubrir tus gastos de viaje");
      const current = await runCountry();
      expect(JSON.parse(current.stdout).data.registration.countryCode).toBe(
        "CO",
      );
      expect(writes).toBe(1);
      const changed = await runCountry("--code", "PE");
      expect(JSON.parse(changed.stdout).error.code).toBe("COUNTRY_ALREADY_SET");
      const invalid = await runCountry("--code", "ZZ");
      expect(JSON.parse(invalid.stdout).error.code).toBe("VALIDATION_ERROR");
      expect(writes).toBe(1);
    } finally {
      server.stop(true);
    }
  });
  test("returns one JSON error document for invalid arguments", async () => {
    const { exitCode, stderr, stdout } = await runCli(
      "--output",
      "json",
      "schema",
      "--stage",
      "invalid",
    );

    expect(exitCode).toBe(2);
    expect(stderr).toBe("");
    expect(stdout.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(stdout)).toMatchObject({
      version: 1,
      ok: false,
      error: {
        code: "CLI_PARSE_ERROR",
        retryable: false,
      },
    });
  });

  test("returns JSON for built-in help and version flags", async () => {
    const help = await runCli("--output", "json", "--help");
    const version = await runCli("--output=json", "--version");

    expect(help.exitCode).toBe(0);
    expect(JSON.parse(help.stdout)).toMatchObject({
      version: 1,
      ok: true,
      data: { helpRequested: true },
    });
    expect(version.exitCode).toBe(0);
    expect(JSON.parse(version.stdout)).toMatchObject({
      version: 1,
      ok: true,
      data: { cliVersion: "0.1.0" },
    });
  });

  test("advertises a command that verifies authentication", async () => {
    const help = await runCli("--help");

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("whoami");
    expect(help.stdout).toContain("Verify the current Clerk authentication");
  });

  test("advertises the equivalent CLI update and upgrade commands", async () => {
    const help = await runCli("--help");

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("update");
    expect(help.stdout).toContain("upgrade");
    expect(help.stdout).toContain(
      "Actualiza chofex-cli y su skill de agente a la última versión",
    );
  });

  test("advertises mini technical challenges", async () => {
    const help = await runCli("--help");

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("challenge");
    expect(help.stdout).toContain("Compite en challenges técnicos");
  });

  test("does not initialize files for a closed challenge", async () => {
    const directory = await mkdtemp(join(tmpdir(), "chofex-challenge-"));
    const solutionPath = join(directory, "shipping.js");

    try {
      const result = await runCliFrom(
        directory,
        "challenge",
        "init",
        "--challenge",
        "black-box",
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("CHALLENGE_CLOSED");
      expect(result.stderr).toContain("está cerrado");
      expect(await Bun.file(solutionPath).exists()).toBe(false);

      const json = await runCliFrom(
        directory,
        "--output",
        "json",
        "challenge",
        "init",
        "--challenge",
        "black-box",
      );
      expect(json.stderr).toBe("");
      expect(json.stdout.trim().split("\n")).toHaveLength(1);
      expect(JSON.parse(json.stdout)).toMatchObject({
        ok: false,
        error: { code: "CHALLENGE_CLOSED" },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("rejects the closed Broken Agent starter without overwriting work", async () => {
    const directory = await mkdtemp(join(tmpdir(), "chofex-broken-agent-"));
    const challengeDirectory = join(directory, "broken-agent");
    const solutionPath = join(challengeDirectory, "scheduler.js");

    try {
      const created = await runCliFrom(
        directory,
        "challenge",
        "init",
        "--challenge",
        "broken-agent",
      );

      expect(created.exitCode).toBe(2);
      expect(created.stdout).toBe("");
      expect(created.stderr).toContain("CHALLENGE_CLOSED");
      expect(created.stderr).toContain("Espera el próximo challenge");
      expect(await Bun.file(solutionPath).exists()).toBe(false);

      await Bun.write(solutionPath, "// repaired by me\n");

      const repeated = await runCliFrom(
        directory,
        "challenge",
        "init",
        "--challenge",
        "broken-agent",
      );
      expect(repeated.exitCode).toBe(2);
      expect(repeated.stderr).toContain("CHALLENGE_CLOSED");
      expect(await Bun.file(solutionPath).text()).toBe("// repaired by me\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("documents the workflow and every challenge subcommand", async () => {
    const challengeHelp = await runCli("challenge", "--help");

    expect(challengeHelp.exitCode).toBe(0);
    expect(challengeHelp.stdout).toContain("challenge actual");
    expect(challengeHelp.stdout).toContain("Chofex API base URL");
    expect(challengeHelp.stdout).toContain(
      "andes challenge init --challenge broken-agent",
    );

    const expectedExamples = new Map([
      ["list", "andes challenge list"],
      ["init", "andes challenge init --challenge broken-agent"],
      ["show", "andes challenge show"],
      [
        "query",
        "andes challenge query --challenge black-box --input shipment.json",
      ],
      [
        "notebook",
        "andes challenge notebook --challenge black-box --format csv",
      ],
      [
        "test",
        "andes challenge test --challenge broken-agent --source ./scheduler.js",
      ],
      [
        "evaluate",
        "andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json",
      ],
      ["ranking", "andes challenge ranking --challenge broken-agent"],
    ]);

    for (const [command, example] of expectedExamples) {
      const help = await runCli("challenge", command, "--help");
      expect(help.exitCode).toBe(0);
      expect(help.stdout).toContain("EXAMPLES");
      expect(help.stdout).toContain(example);
    }
  });

  test("lists challenges from the public catalog without authentication", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-challenges",
          data: {
            challenges: [
              {
                slug: "black-box",
                number: 1,
                code: "01",
                theme: "Black Box",
                title: "The Shipping Machine",
                summary: "Reverse engineer shipping prices.",
                coreSkill: "Reverse engineering",
                format: "accuracy",
                formatLabel: "Accuracy score",
                opensAt: "2026-09-18T05:00:00.000Z",
                queryLimit: 25,
                evaluationLimit: 3,
                playable: true,
                open: true,
                rankingPath: "/challenges/black-box",
              },
            ],
          },
        });
      },
    });

    try {
      const result = await runCli(
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--output",
        "json",
        "challenge",
        "list",
      );
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        data: { challenges: [{ slug: "black-box", playable: true }] },
      });
    } finally {
      server.stop(true);
    }
  });

  test("turns each oracle answer into the next experiment", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-query",
          data: {
            observation: {
              sequence: 1,
              input: {
                distanceKm: 100,
                weightKg: 100,
                hour: 18,
                fragile: true,
                express: false,
              },
              output: 314.5,
              createdAt: "2026-09-16T00:00:00.000Z",
            },
            queriesUsed: 1,
            queriesRemaining: 24,
            queriesLimit: 25,
          },
        });
      },
    });

    try {
      const result = await runCli(
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "challenge",
        "query",
        "--distance",
        "100",
        "--weight",
        "100",
        "--hour",
        "18",
        "--fragile",
        "true",
        "--express",
        "false",
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Observation #1 saved");
      expect(result.stdout).toContain("Change one variable at a time");
      expect(result.stdout).toContain("andes challenge notebook");
    } finally {
      server.stop(true);
    }
  });

  test("reads a small notebook as evidence instead of an answer", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-notebook",
          data: {
            challenge: {
              slug: "black-box",
              number: 1,
              code: "01",
              theme: "Black Box",
              title: "The Shipping Machine",
              summary: "Reverse engineer shipping prices.",
              coreSkill: "Reverse engineering",
              format: "accuracy",
              formatLabel: "Accuracy score",
              opensAt: "2026-09-18T05:00:00.000Z",
              queryLimit: 25,
              evaluationLimit: 3,
              playable: true,
              open: true,
              rankingPath: "/challenges/black-box",
            },
            progress: {
              slug: "black-box",
              title: "The Shipping Machine",
              theme: "Black Box",
              status: "in_progress",
              open: true,
              playable: true,
              queriesUsed: 1,
              queriesLimit: 25,
              evaluationsUsed: 0,
              evaluationsLimit: 3,
            },
            observations: [
              {
                sequence: 1,
                input: {
                  distanceKm: 100,
                  weightKg: 100,
                  hour: 18,
                  fragile: true,
                  express: false,
                },
                output: 314.5,
                createdAt: "2026-09-16T00:00:00.000Z",
              },
            ],
            aiAllowed: true,
            localTestHint: "Use your notebook before evaluating.",
          },
        });
      },
    });

    try {
      const result = await runCli(
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "challenge",
        "notebook",
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("CASE FILE: 1 observation");
      expect(result.stdout).not.toContain("\t");
      expect(result.stdout).toContain("One answer is a clue, not a rule");
      expect(result.stdout).toContain("Next: run a controlled experiment");
      expect(result.stdout).toContain("andes challenge init");

      const status = await runCli(
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "challenge",
        "show",
      );
      expect(status.exitCode).toBe(0);
      expect(status.stdout).toContain("CASE STATUS: INVESTIGATING");
      expect(status.stdout).toContain("Evidence       1 observation");
      expect(status.stdout).toContain("Queries        24 / 25 remaining");
      expect(status.stdout).toContain("YOUR NEXT MOVE");
    } finally {
      server.stop(true);
    }
  });

  test("explains what to do after local and official evaluations", async () => {
    const sourcePath = join(
      cliDirectory,
      `.shipping-${crypto.randomUUID()}.js`,
    );
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname;
        if (path.endsWith("/test")) {
          return Response.json({
            version: 1,
            ok: true,
            requestId: "request-test",
            data: {
              matchedObservations: 1,
              observationCount: 2,
              accuracy: 0.5,
              meanError: 10,
              mismatches: [{ sequence: 2, expected: 42, actual: 22 }],
            },
          });
        }
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-evaluate",
          data: {
            accuracy: 0.92,
            exactCount: 920,
            sampleSize: 1_000,
            meanError: 1.2,
            queriesUsed: 12,
            runtimeMs: 5,
            shareCode: "ABCD",
            rank: 3,
            competitorCount: 20,
            percentile: 15,
            evaluationsUsed: 1,
            evaluationsRemaining: 2,
            evaluationsLimit: 3,
            rankingPath: "/challenges/black-box",
            shareText: "92.00% replication",
          },
        });
      },
    });

    try {
      await writeFile(
        sourcePath,
        "function calculateShipping() { return 0; }\n",
        "utf8",
      );
      const commonArguments = [
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "challenge",
      ] as const;
      const local = await runCli(
        ...commonArguments,
        "test",
        "--challenge",
        "black-box",
        "--source",
        sourcePath,
      );
      expect(local.exitCode).toBe(0);
      expect(local.stdout).toContain("NOTEBOOK VERDICT: KEEP WORKING");
      expect(local.stdout).toContain("Next: edit shipping.js");

      const official = await runCli(
        ...commonArguments,
        "evaluate",
        "--challenge",
        "black-box",
        "--source",
        sourcePath,
      );
      expect(official.exitCode).toBe(0);
      expect(official.stdout).toContain("OFFICIAL VERDICT");
      expect(official.stdout).toContain("Next: inspect the leaderboard");
      expect(official.stdout).toContain("andes challenge ranking");
    } finally {
      server.stop(true);
      await unlink(sourcePath).catch(() => undefined);
    }
  });

  test("stops Broken Agent evaluation until the participant provides a review", async () => {
    const sourcePath = join(
      cliDirectory,
      `.scheduler-${crypto.randomUUID()}.js`,
    );
    try {
      await writeFile(sourcePath, "function createScheduler() {}\n", "utf8");
      const result = await runCli(
        "--output",
        "json",
        "challenge",
        "evaluate",
        "--challenge",
        "broken-agent",
        "--source",
        sourcePath,
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: false,
        error: {
          code: "HUMAN_REVIEW_REQUIRED",
          details: {
            sourceDigest: createHash("sha256")
              .update("function createScheduler() {}\n")
              .digest("hex"),
            requiredFields: [
              "sourceDigest",
              "focus",
              "failureScenario",
              "evidence",
              "decision",
              "confidence",
              "remainingRisk",
            ],
          },
        },
      });
    } finally {
      await unlink(sourcePath).catch(() => undefined);
    }
  });

  test("binds the participant review to the exact Broken Agent source", async () => {
    const sourcePath = join(
      cliDirectory,
      `.scheduler-${crypto.randomUUID()}.js`,
    );
    const reviewPath = join(
      cliDirectory,
      `.review-${crypto.randomUUID()}.json`,
    );
    const source = "function createScheduler() { return {}; }\n";
    let submittedBody: unknown;
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        if (request.method === "GET")
          return new Response(null, { status: 503 });
        submittedBody = await request.json();
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-reviewed-evaluate",
          data: {
            accuracy: 1,
            exactCount: 100,
            sampleSize: 100,
            meanError: 0,
            queriesUsed: 0,
            runtimeMs: 0,
            executionCost: 500,
            shareCode: "ABCD",
            evaluationsUsed: 1,
            evaluationsRemaining: 4,
            evaluationsLimit: 5,
            rankingPath: "/challenges/broken-agent",
            shareText: "100 preparación para producción",
          },
        });
      },
    });
    const review = {
      sourceDigest: "0".repeat(64),
      focus: "concurrency",
      failureScenario:
        "Dos workers reclaman el mismo job y ambos aplican el efecto antes de completar.",
      evidence:
        "Revisé una prueba con dos runDue simultáneos y observé una sola llamada al executor.",
      decision: "ship",
      confidence: 80,
      remainingRisk:
        "El store de producción todavía podría tener latencias distintas a las del test.",
    };

    try {
      await writeFile(sourcePath, source, "utf8");
      await writeFile(reviewPath, JSON.stringify(review), "utf8");
      const commonArguments = [
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "--output",
        "json",
        "challenge",
        "evaluate",
        "--challenge",
        "broken-agent",
        "--source",
        sourcePath,
        "--review",
        reviewPath,
      ] as const;

      const stale = await runCli(...commonArguments);
      expect(stale.exitCode).toBe(2);
      expect(JSON.parse(stale.stdout)).toMatchObject({
        ok: false,
        error: { code: "STALE_HUMAN_REVIEW" },
      });
      expect(submittedBody).toBeUndefined();

      review.sourceDigest = createHash("sha256").update(source).digest("hex");
      await writeFile(reviewPath, JSON.stringify(review), "utf8");
      const submitted = await runCli(...commonArguments);
      expect(submitted.exitCode).toBe(0);
      expect(JSON.parse(submitted.stdout)).toMatchObject({ ok: true });
      expect(submittedBody).toMatchObject({ review });
    } finally {
      server.stop(true);
      await unlink(sourcePath).catch(() => undefined);
      await unlink(reviewPath).catch(() => undefined);
    }
  });

  test("prints the participant-only browser handoff without consuming an evaluation", async () => {
    const sourcePath = join(
      cliDirectory,
      `.scheduler-${crypto.randomUUID()}.js`,
    );
    const reviewPath = join(
      cliDirectory,
      `.review-${crypto.randomUUID()}.json`,
    );
    const source = "function createScheduler() { return {}; }\n";
    const review = {
      sourceDigest: createHash("sha256").update(source).digest("hex"),
      focus: "concurrency",
      failureScenario:
        "Dos workers reclaman el mismo job y ambos aplican el efecto antes de completar.",
      evidence:
        "Revisé una prueba con dos runDue simultáneos y observé una sola llamada al executor.",
      decision: "ship",
      confidence: 80,
      remainingRisk:
        "El store de producción todavía podría tener latencias distintas a las del test.",
    };
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json(
          {
            version: 1,
            ok: false,
            requestId: "request-human-approval",
            error: {
              code: "HUMAN_APPROVAL_REQUIRED",
              message: "Participant approval required",
              retryable: false,
              details: {
                approvalUrl:
                  "https://hacktheandes.com/challenges/broken-agent/approve/approval_1",
                expiresAt: "2026-09-25T23:00:00.000Z",
                evaluationsRemaining: 5,
                retryCommand:
                  "andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json",
              },
            },
          },
          { status: 428 },
        );
      },
    });

    try {
      await writeFile(sourcePath, source, "utf8");
      await writeFile(reviewPath, JSON.stringify(review), "utf8");
      const result = await runCli(
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "challenge",
        "evaluate",
        "--challenge",
        "broken-agent",
        "--source",
        sourcePath,
        "--review",
        reviewPath,
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(
        "INTERVENCIÓN DEL PARTICIPANTE REQUERIDA",
      );
      expect(result.stderr).toContain("todavía no consumió un intento");
      expect(result.stderr).toContain(
        "https://hacktheandes.com/challenges/broken-agent/approve/approval_1",
      );
      expect(result.stderr).toContain("Después de aprobar, repite:");
    } finally {
      server.stop(true);
      await unlink(sourcePath).catch(() => undefined);
      await unlink(reviewPath).catch(() => undefined);
    }
  });

  test("explains that an unfinished official evaluation did not consume an attempt", async () => {
    const sourcePath = join(
      cliDirectory,
      `.scheduler-${crypto.randomUUID()}.js`,
    );
    const reviewPath = join(
      cliDirectory,
      `.review-${crypto.randomUUID()}.json`,
    );
    const source = "function createScheduler() { return {}; }\n";
    const review = {
      sourceDigest: createHash("sha256").update(source).digest("hex"),
      focus: "concurrency",
      failureScenario:
        "Dos workers reclaman el mismo job y ambos aplican el efecto antes de completar.",
      evidence:
        "Revisé una prueba con dos runDue simultáneos y observé una sola llamada al executor.",
      decision: "ship",
      confidence: 80,
      remainingRisk:
        "El store de producción todavía podría tener latencias distintas a las del test.",
    };
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json(
          {
            version: 1,
            ok: false,
            requestId: "request-engine-unavailable",
            error: {
              code: "CHALLENGE_ENGINE_UNAVAILABLE",
              message:
                "The official evaluation could not be completed. This attempt was not consumed.",
              retryable: true,
            },
          },
          { status: 503 },
        );
      },
    });

    try {
      await writeFile(sourcePath, source, "utf8");
      await writeFile(reviewPath, JSON.stringify(review), "utf8");
      const result = await runCli(
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "challenge",
        "evaluate",
        "--challenge",
        "broken-agent",
        "--source",
        sourcePath,
        "--review",
        reviewPath,
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("no se pudo completar");
      expect(result.stderr).toContain("No es un error de tu computadora");
      expect(result.stderr).toContain("este intento no se consumió");
      expect(result.stderr).toContain(
        "andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json",
      );
    } finally {
      server.stop(true);
      await unlink(sourcePath).catch(() => undefined);
      await unlink(reviewPath).catch(() => undefined);
    }
  });

  test("advertises local input validation", async () => {
    const help = await runCli("--help");

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("validate");
    expect(help.stdout).toContain("Validate input without submitting it");
  });

  test("advertises the participant badge command", async () => {
    const help = await runCli("--help");

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("badge");
    expect(help.stdout).toContain("Muestra o regenera tu carnet");

    const badgeHelp = await runCli("badge", "--help");
    expect(badgeHelp.stdout).toContain("regenerate");
    expect(badgeHelp.stdout).toContain("presentación");
  });

  test("never opens badge prompts in JSON mode", async () => {
    const result = await runCli("--output", "json", "badge", "regenerate");
    const envelope = JSON.parse(result.stdout) as {
      readonly ok: boolean;
      readonly error: { readonly code: string };
    };

    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("INPUT_REQUIRED");
  });

  test("prints every accepted application input field", async () => {
    const result = await runCli("schema");

    expect(result.exitCode).toBe(0);
    const template = JSON.parse(result.stdout);
    expect(Object.keys(template).sort()).toEqual(
      [...applicationInputFieldNames].sort(),
    );
    expect(template).toHaveProperty("githubUrl");
    expect(template).toHaveProperty("linkedInUrl");
    expect(template).toHaveProperty("fullName");
    expect(template).toHaveProperty("role");
    expect(template).toHaveProperty("phone");
    expect(template).toHaveProperty("bio");
    expect(template).toHaveProperty("portfolioUrl");
    expect(template).toHaveProperty("shippedProject");
    expect(template).toHaveProperty("codeOfConductAccepted");
    expect(template).not.toHaveProperty("email");
    expect(template).toHaveProperty("countryCode", "PE");
    expect(template).not.toHaveProperty("participationMode");
  });

  test("prints every accepted attendance input field", async () => {
    const result = await runCli("schema", "--stage", "acceptance");

    expect(result.exitCode).toBe(0);
    const template = JSON.parse(result.stdout);
    expect(Object.keys(template).sort()).toEqual(
      [...acceptedDetailsInputFieldNames].sort(),
    );
    expect(template).toHaveProperty("name");
    expect(template).toHaveProperty("oneLiner");
  });

  test("validates an application without contacting the API", async () => {
    const inputPath = `${cliDirectory}.valid-application-${crypto.randomUUID()}.json`;

    try {
      await Bun.write(
        inputPath,
        JSON.stringify({
          fullName: "Anthony Cueva",
          role: "Builder",
          countryCode: "PE",
          codeOfConductAccepted: true,
        }),
      );
      const result = await runCli(
        "--output",
        "json",
        "validate",
        "--stage",
        "application",
        "--input",
        inputPath,
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        version: 1,
        ok: true,
        data: {
          valid: true,
          stage: "application",
        },
      });
    } finally {
      await unlink(inputPath).catch(() => undefined);
    }
  });

  test("validates attendance details without echoing private input", async () => {
    const inputPath = `${cliDirectory}.valid-attendance-${crypto.randomUUID()}.json`;
    const nationalIdNumber = "private-passport-number";

    try {
      await Bun.write(
        inputPath,
        JSON.stringify({
          fullName: "Ada Lovelace",
          phone: "+51 999 999 999",
          dateOfBirth: "1990-01-01",
          nationalIdNumber,
          shirtSize: "m",
          emergencyContactName: "Grace Hopper",
          emergencyContactPhone: "+1 555 0100",
          pictureSource: "clerk",
        }),
      );
      const result = await runCli(
        "--output",
        "json",
        "validate",
        "--stage",
        "acceptance",
        "--input",
        inputPath,
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        data: {
          valid: true,
          stage: "acceptance",
        },
      });
      expect(result.stdout).not.toContain(nationalIdNumber);
    } finally {
      await unlink(inputPath).catch(() => undefined);
    }
  });

  test("returns accepted field names for invalid input", async () => {
    const inputPath = `${cliDirectory}.invalid-application-${crypto.randomUUID()}.json`;

    try {
      await Bun.write(
        inputPath,
        JSON.stringify({
          fullName: "Anthony Cueva",
          role: "Builder",
          github: "https://github.com/cuevaio",
          codeOfConductAccepted: true,
        }),
      );
      const result = await runCli(
        "--output",
        "json",
        "validate",
        "--stage",
        "application",
        "--input",
        inputPath,
      );

      expect(result.exitCode).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          details: {
            acceptedFields: expect.arrayContaining([
              "fullName",
              "role",
              "bio",
              "portfolioUrl",
              "shippedProject",
              "githubUrl",
              "linkedInUrl",
            ]),
          },
        },
      });
    } finally {
      await unlink(inputPath).catch(() => undefined);
    }
  });

  test("submits a normalized on-site application without identity fields", async () => {
    let submittedBody: unknown;
    let submittedMethod: string | undefined;
    let submittedPath: string | undefined;
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        if (request.method === "GET") {
          return Response.json(
            {
              version: 1,
              ok: false,
              requestId: "request-no-registration",
              error: {
                code: "REGISTRATION_NOT_FOUND",
                message: "Registration not found",
                retryable: false,
              },
            },
            { status: 404 },
          );
        }
        submittedMethod = request.method;
        submittedPath = new URL(request.url).pathname;
        submittedBody = await request.json();
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-registration",
          data: {
            registration: {
              id: "registration-123",
              status: "submitted",
              firstName: "Anthony",
              lastName: "Cueva",
              email: "hi@cueva.io",
              role: "Builder",
              participationMode: "in_person",
              githubUrl: "https://github.com/cuevaio",
              nationalIdProvided: false,
              mediaConsent: false,
              codeOfConductAccepted: true,
              privacyPolicyAccepted: true,
              createdAt: "2026-09-09T00:00:00.000Z",
              updatedAt: "2026-09-09T00:00:00.000Z",
              challenges: [],
            },
            requirements: {
              stage: "review",
              canSubmitNewApplication: false,
              canSubmitAcceptedDetails: false,
              canSaveDraft: false,
              canSubmitApplication: false,
              parts: [],
              missing: [],
            },
          },
        });
      },
    });
    const inputPath = `${cliDirectory}.application-${crypto.randomUUID()}.json`;

    try {
      await Bun.write(
        inputPath,
        JSON.stringify({
          fullName: " Anthony Cueva ",
          countryCode: "CO",
          role: "Builder",
          phone: "+51 999 999 999",
          bio: "I build developer tools.",
          portfolioUrl: "cueva.io",
          shippedProject: "A collaborative coding environment.",
          githubUrl: "github.com/cuevaio",
          codeOfConductAccepted: true,
        }),
      );
      const apiUrl = server.url.toString().replace(/\/$/, "");
      const result = await runCli(
        "--api-url",
        apiUrl,
        "--token",
        "oauth-token",
        "--output",
        "json",
        "register",
        "--input",
        inputPath,
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        data: { registration: { status: "submitted" } },
      });
      expect(submittedMethod).toBe("POST");
      expect(submittedPath).toBe("/api/v1/registrations");
      expect(submittedBody).toEqual({
        countryCode: "CO",
        fullName: "Anthony Cueva",
        role: "Builder",
        phone: "+51 999 999 999",
        bio: "I build developer tools.",
        portfolioUrl: "https://cueva.io",
        shippedProject: "A collaborative coding environment.",
        githubUrl: "https://github.com/cuevaio",
        codeOfConductAccepted: true,
      });
      expect(submittedBody).not.toHaveProperty("email");
      expect(result.stdout.trim().split("\n")).toHaveLength(1);
      expect(result.stderr).toContain("debes cubrir tus gastos de viaje");
      expect(result.stderr).toContain("talento excepcional");
      expect(submittedBody).not.toHaveProperty("participationMode");
      expect(submittedBody).not.toHaveProperty("firstName");
      expect(submittedBody).not.toHaveProperty("lastName");
    } finally {
      server.stop(true);
      await unlink(inputPath).catch(() => undefined);
    }
  });

  for (const scenario of [
    {
      name: "an application awaits approval",
      status: "submitted",
      requirements: {
        stage: "review",
        canSubmitNewApplication: false,
        canSubmitAcceptedDetails: false,
        canSaveDraft: false,
        canSubmitApplication: false,
        parts: [],
        missing: [],
      },
      expectedMessage: "Siguiente comando: andes challenge list",
    },
    {
      name: "an application is accepted",
      status: "accepted",
      requirements: {
        stage: "accepted",
        canSubmitNewApplication: false,
        canSubmitAcceptedDetails: true,
        canSaveDraft: false,
        canSubmitApplication: false,
        parts: [],
        missing: [{ field: "phone", reason: "Required after acceptance" }],
      },
      expectedMessage: "Siguiente comando: andes confirm",
    },
    {
      name: "an accepted registration is complete",
      status: "accepted",
      requirements: {
        stage: "complete",
        canSubmitNewApplication: false,
        canSubmitAcceptedDetails: true,
        canSaveDraft: false,
        canSubmitApplication: false,
        parts: [],
        missing: [],
      },
      expectedMessage: "Siguiente comando: andes badge",
    },
  ] as const) {
    test(`stops before collecting input when ${scenario.name}`, async () => {
      let postRequested = false;
      const server = Bun.serve({
        port: 0,
        fetch(request) {
          if (request.method === "POST") postRequested = true;
          return Response.json({
            version: 1,
            ok: true,
            requestId: "request-existing-registration",
            data: {
              registration: {
                id: "registration-123",
                status: scenario.status,
                firstName: "Anthony",
                lastName: "Cueva",
                email: "hi@cueva.io",
                role: "Builder",
                participationMode: "in_person",
                nationalIdProvided: false,
                mediaConsent: false,
                codeOfConductAccepted: true,
                privacyPolicyAccepted: true,
                submittedAt: "2026-09-09T00:00:00.000Z",
                createdAt: "2026-09-09T00:00:00.000Z",
                updatedAt: "2026-09-09T00:00:00.000Z",
                challenges: [],
              },
              requirements: scenario.requirements,
            },
          });
        },
      });

      try {
        const apiUrl = server.url.toString().replace(/\/$/, "");
        const result = await runCli(
          "--api-url",
          apiUrl,
          "--token",
          "oauth-token",
          "register",
          "--input",
          "does-not-exist.json",
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(scenario.expectedMessage);
        expect(result.stderr).toBe("");
        expect(postRequested).toBe(false);
      } finally {
        server.stop(true);
      }
    });
  }

  test("renders verified authentication in human and JSON modes", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (
          new URL(request.url).pathname !== "/api/v1/me" ||
          request.method !== "GET" ||
          request.headers.get("authorization") !== "Bearer oauth-token"
        ) {
          return new Response(null, { status: 404 });
        }
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-whoami",
          data: {
            authenticated: true,
            userId: "user_123",
            email: "ada@example.com",
            tokenType: "oauth_token",
          },
        });
      },
    });

    try {
      const apiUrl = server.url.toString().replace(/\/$/, "");
      const human = await runCli(
        "--api-url",
        apiUrl,
        "--token",
        "oauth-token",
        "whoami",
      );
      const json = await runCli(
        "--api-url",
        apiUrl,
        "--token",
        "oauth-token",
        "--output",
        "json",
        "whoami",
      );

      expect(human.exitCode).toBe(0);
      expect(human.stdout.trim()).toContain(
        "Sesión iniciada como ada@example.com (user_123, oauth_token).",
      );
      expect(json.exitCode).toBe(0);
      expect(JSON.parse(json.stdout)).toMatchObject({
        ok: true,
        data: {
          authenticated: true,
          userId: "user_123",
          email: "ada@example.com",
          tokenType: "oauth_token",
        },
      });
    } finally {
      server.stop(true);
    }
  });

  test("prints structured API validation details in human mode", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json(
          {
            version: 1,
            ok: false,
            requestId: "request-validation",
            error: {
              code: "VALIDATION_ERROR",
              message: "Input validation failed",
              retryable: false,
              details: {
                issues: [{ field: "teamName", reason: "Required" }],
              },
            },
          },
          { status: 422 },
        );
      },
    });

    try {
      const apiUrl = server.url.toString().replace(/\/$/, "");
      const result = await runCli(
        "--api-url",
        apiUrl,
        "--token",
        "oauth-token",
        "status",
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("teamName: Required");
      expect(result.stderr).toContain("Request ID: request-validation");
    } finally {
      server.stop(true);
    }
  });

  for (const command of ["status", "requirements"] as const) {
    test(`${command} invites a participant without an application to register`, async () => {
      const server = Bun.serve({
        port: 0,
        fetch() {
          return Response.json(
            {
              version: 1,
              ok: false,
              requestId: "request-no-registration",
              error: {
                code: "REGISTRATION_NOT_FOUND",
                message: "Registration not found",
                retryable: false,
              },
            },
            { status: 404 },
          );
        },
      });

      try {
        const apiUrl = server.url.toString().replace(/\/$/, "");
        const result = await runCli(
          "--api-url",
          apiUrl,
          "--token",
          "oauth-token",
          command,
        );

        expect(result.exitCode).toBe(4);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("Todavía no tienes una postulación.");
        expect(result.stderr).toContain("Siguiente comando: andes register");
        expect(result.stderr).toContain("Request ID: request-no-registration");
      } finally {
        server.stop(true);
      }
    });
  }

  test("requires a computer path when an accepted participant chooses upload", async () => {
    const inputPath = `${cliDirectory}.attendance-${crypto.randomUUID()}.json`;
    let attendanceSubmitted = false;
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === "/api/v1/me") {
          return Response.json({
            version: 1,
            ok: true,
            requestId: "request-me",
            data: {
              authenticated: true,
              userId: "user-123",
              email: "ada@example.com",
              tokenType: "oauth_token",
            },
          });
        }
        if (path === "/api/v1/badge") {
          return Response.json({
            version: 1,
            ok: true,
            requestId: "request-badge",
            data: {
              status: "completed",
              url: "https://example.com/badge.png",
              profile: {
                fullName: "Ada Lovelace",
                oneLiner: "Programmer",
                linkUrl: "https://example.com",
                placement: "PARTICIPANT",
              },
            },
          });
        }
        if (request.method === "PUT") attendanceSubmitted = true;
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-registration",
          data: {
            registration: {
              id: "application-123",
              status: "accepted",
              firstName: "Ada",
              lastName: "Lovelace",
              email: "ada@example.com",
              participationMode: "in_person",
              nationalIdProvided: false,
              mediaConsent: false,
              codeOfConductAccepted: true,
              privacyPolicyAccepted: true,
              submittedAt: "2026-09-09T00:00:00.000Z",
              createdAt: "2026-09-09T00:00:00.000Z",
              updatedAt: "2026-09-09T00:00:00.000Z",
              challenges: [],
            },
            requirements: {
              stage: "accepted",
              canSubmitNewApplication: false,
              canSubmitAcceptedDetails: true,
              canSaveDraft: false,
              canSubmitApplication: false,
              parts: [],
              missing: [],
            },
          },
        });
      },
    });

    try {
      await Bun.write(
        inputPath,
        JSON.stringify({
          fullName: "Ada Lovelace",
          phone: "+51 999 999 999",
          dateOfBirth: "1990-01-01",
          nationalIdNumber: "private-passport-number",
          shirtSize: "m",
          emergencyContactName: "Grace Hopper",
          emergencyContactPhone: "+1 555 0100",
          pictureSource: "upload",
        }),
      );
      const result = await runCli(
        "--api-url",
        server.url.toString(),
        "--token",
        "oauth-token",
        "confirm",
        "--input",
        inputPath,
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Use --picture <path>");
      expect(attendanceSubmitted).toBe(false);
    } finally {
      server.stop(true);
      await unlink(inputPath).catch(() => undefined);
    }
  });
});
