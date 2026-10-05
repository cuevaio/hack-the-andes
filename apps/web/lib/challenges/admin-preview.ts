import { createHash, timingSafeEqual } from "node:crypto";
import { powerGridChallengeVersion } from "@chofex/challenges-contract/power-grid";
import { Schema } from "effect";
import { requireAdminIdentity } from "../admin/auth";
import { HttpError } from "../registration/http";
import {
  type AdminPreviewRequest,
  AdminPreviewRequestSchema,
  type AdminPreviewResult,
} from "./admin-preview-contract";
import { ChallengeEngineError, challengeEngine } from "./engine";
import { runPowerGridSolution } from "./sandbox";

export const requireAdminPreviewSecret = (
  provided: string | null,
  expected = process.env.POWER_GRID_ADMIN_PREVIEW_SECRET,
): void => {
  if (!expected || expected.length < 32)
    throw new HttpError(
      503,
      "PREVIEW_DISABLED",
      "La prueba privada no está configurada.",
    );
  if (!provided || provided.length > 256)
    throw new HttpError(
      403,
      "PREVIEW_SECRET_REQUIRED",
      "La clave de prueba no es válida.",
    );
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(provided), digest(expected)))
    throw new HttpError(
      403,
      "PREVIEW_SECRET_REQUIRED",
      "La clave de prueba no es válida.",
    );
};

export const parseAdminPreviewRequest = (
  input: unknown,
): AdminPreviewRequest => {
  try {
    return Schema.decodeUnknownSync(AdminPreviewRequestSchema, {
      onExcessProperty: "error",
    })(input);
  } catch {
    throw new HttpError(
      422,
      "INVALID_PREVIEW_INPUT",
      "Revisa los campos de la lectura o el código. Se aceptan hasta 25 observaciones y 32,768 caracteres de código.",
    );
  }
};

export const createAdminPreview =
  (
    engine: ReturnType<typeof challengeEngine>,
    runSolution = runPowerGridSolution,
  ) =>
  async (
    adminUserId: string,
    request: AdminPreviewRequest,
  ): Promise<AdminPreviewResult> => {
    const participantKey = createHash("sha256")
      .update(`admin-preview:${powerGridChallengeVersion}:${adminUserId}`)
      .digest("hex");
    switch (request.action) {
      case "unlock":
        return { action: "unlock", version: powerGridChallengeVersion };
      case "query":
        return {
          action: "query",
          observation: {
            input: request.input,
            output: await engine.queryPowerGrid(participantKey, request.input),
          },
        };
      case "evaluate":
        return {
          action: "evaluate",
          score: await engine.evaluate(
            powerGridChallengeVersion,
            participantKey,
            request.source,
            0,
          ),
        };
      case "test": {
        if (request.observations.length === 0)
          throw new HttpError(
            422,
            "NO_OBSERVATIONS",
            "Consulta la máquina antes de probar el cuaderno.",
          );
        const predictions = await runSolution(
          request.source,
          request.observations.map((item) => item.input),
        );
        let matched = 0;
        let error = 0;
        const mismatches: {
          sequence: number;
          expected: number;
          actual: number;
        }[] = [];
        for (const [index, observation] of request.observations.entries()) {
          const actual = predictions[index];
          if (actual === undefined)
            throw new HttpError(
              422,
              "SOLUTION_EXECUTION_FAILED",
              "La solución no devolvió todas las predicciones.",
            );
          if (observation.output === actual) matched += 1;
          else
            mismatches.push({
              sequence: index + 1,
              expected: observation.output,
              actual,
            });
          error += Math.abs(observation.output - actual);
        }
        const count = request.observations.length;
        return {
          action: "test",
          result: {
            accuracy: matched / count,
            meanError: error / count,
            matchedObservations: matched,
            observationCount: count,
            mismatches,
          },
        };
      }
      default: {
        const exhaustive: never = request;
        return exhaustive;
      }
    }
  };

export const handleAdminPreview = async (
  request: Request,
  input: unknown,
): Promise<AdminPreviewResult> => {
  const admin = await requireAdminIdentity();
  requireAdminPreviewSecret(request.headers.get("x-challenge-preview-secret"));
  const payload = parseAdminPreviewRequest(input);
  if (payload.action === "unlock")
    return { action: "unlock", version: powerGridChallengeVersion };
  try {
    return await createAdminPreview(challengeEngine())(
      admin.clerkUserId,
      payload,
    );
  } catch (error) {
    if (error instanceof ChallengeEngineError)
      throw new HttpError(
        error.status,
        error.code,
        error.message,
        error.status >= 500,
      );
    throw error;
  }
};
