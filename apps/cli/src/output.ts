import {
  type ApiSuccess,
  type BadgeResult,
  type CreatedRegistration,
  type RegistrationResult,
  RequirementSchema,
} from "@chofex/registration-contract";
import { Console, Effect, Result, Schema } from "effect";

import { registrationPartsText } from "./challenge-output.js";
import { type CliError, exitCodeFor } from "./errors.js";
import { nextStepFor, nextStepText } from "./participant-guidance.js";

export type OutputMode = "human" | "json";

export const printJson = (value: unknown): Effect.Effect<void> =>
  Effect.sync(() => {
    process.stdout.write(`${JSON.stringify(value)}\n`);
  });

const humanErrorDetails = (details: unknown): string => {
  if (details === undefined) return "";

  if (typeof details === "object" && details !== null && "issues" in details) {
    const issues = details.issues;
    if (Array.isArray(issues)) {
      const decoded = Schema.decodeUnknownResult(
        Schema.Array(RequirementSchema),
      )(issues);
      if (Result.isSuccess(decoded) && decoded.success.length > 0) {
        const lines = decoded.success.map(
          (issue) => `  - ${issue.field}: ${issue.reason}`,
        );
        return `\nDetails:\n${lines.join("\n")}`;
      }
    }
    if (typeof issues === "string") return `\nDetails:\n${issues}`;
  }

  if (typeof details === "string") return `\nDetails:\n${details}`;
  return `\nDetails:\n${JSON.stringify(details, null, 2)}`;
};

export const execute = <A, R>(
  mode: OutputMode,
  operation: Effect.Effect<ApiSuccess<A>, CliError, R>,
  human: (value: A) => string,
  humanError?: (error: CliError) => string | undefined,
): Effect.Effect<void, never, R> =>
  operation.pipe(
    Effect.flatMap((response) => {
      if (mode === "json") return printJson(response);
      return Console.log(human(response.data));
    }),
    Effect.catch((error) => {
      process.exitCode = exitCodeFor(error);
      if (mode === "json") {
        return printJson({
          version: 1,
          ok: false,
          requestId: error.requestId,
          error: {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
            details: error.details,
          },
        });
      }
      const customMessage = humanError?.(error);
      if (customMessage !== undefined) {
        return Console.error(
          `${customMessage}\nRequest ID: ${error.requestId}`,
        );
      }
      const details = humanErrorDetails(error.details);
      return Console.error(
        `Error [${error.code}]: ${error.message}${details}\nRequest ID: ${error.requestId}`,
      );
    }),
  );

export const registrationLookupErrorText = (
  error: CliError,
): string | undefined => {
  if (error.code !== "REGISTRATION_NOT_FOUND") return undefined;
  return `Todavía no tienes una postulación.\n${nextStepText(nextStepFor())}`;
};

const requirementsText = (result: RegistrationResult): string => {
  const { registration, requirements } = result;
  const lines: string[] = [];
  if (requirements.stage === "draft") lines.push(registrationPartsText(result));
  const rejectionReason =
    requirements.rejectionReason ?? registration.rejectionReason;
  if (rejectionReason) lines.push(`Comentario del equipo: ${rejectionReason}`);
  if (requirements.missing.length > 0) {
    const items = requirements.missing
      .map((item) => `  - ${item.field}: ${item.reason}`)
      .join("\n");
    lines.push(`Datos pendientes:\n${items}`);
  }
  lines.push(nextStepText(nextStepFor(result)));
  return lines.join("\n\n");
};

const statusLabels = {
  draft: "Borrador",
  submitted: "Postulación enviada",
  under_review: "En revisión",
  waitlisted: "En lista de espera",
  accepted: "Aceptada",
  rejected: "No aceptada",
  withdrawn: "Retirada",
} satisfies Record<RegistrationResult["registration"]["status"], string>;

export const registrationText = (result: RegistrationResult): string =>
  [
    `Postulación: ${result.registration.id}`,
    `Participante: ${result.registration.firstName} ${result.registration.lastName}`,
    `Estado: ${statusLabels[result.registration.status]}`,
    requirementsText(result),
  ].join("\n");

export const createdText = (result: CreatedRegistration): string => {
  if (result.registration.status === "draft") {
    return ["Borrador guardado.", registrationText(result)].join("\n");
  }
  return ["Postulación enviada.", registrationText(result)].join("\n");
};

export const requirementsOnlyText = (result: RegistrationResult): string =>
  requirementsText(result);

export const badgeText = (result: BadgeResult): string => {
  if (result.status === "completed" && result.url)
    return `Tu carnet está listo:\n${result.url}\n\nCompártelo en LinkedIn o Instagram.\nPara personalizarlo: andes badge regenerate`;
  if (result.status === "pending" || result.status === "running") {
    return "Tu carnet se está generando. Espera unos minutos y consulta de nuevo.\nSiguiente comando: andes badge";
  }
  if (result.status === "failed") {
    return "No se pudo generar tu carnet. Ejecuta `andes badge regenerate` para intentarlo de nuevo.";
  }
  return "Todavía no tienes un carnet. Consulta qué paso te falta completar.\nSiguiente comando: andes status";
};
