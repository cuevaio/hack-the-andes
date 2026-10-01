import type { ChallengeSlug } from "@chofex/challenges-contract";
import type {
  ApiSuccess,
  RegistrationResult,
} from "@chofex/registration-contract";
import { Effect } from "effect";

import { type ApiClientOptions, getRegistration } from "./api-client.js";
import type { CliError } from "./errors.js";

export type NextStep = {
  readonly message: string;
  readonly command: string;
} & (
  | {
      readonly kind:
        | "login"
        | "register"
        | "challenge_unavailable"
        | "decision"
        | "confirm"
        | "badge";
    }
  | {
      readonly kind: "challenge_start" | "challenge_continue";
      readonly challengeSlug: ChallengeSlug;
    }
);

export const nextStepFor = (result?: RegistrationResult): NextStep => {
  if (!result) {
    return {
      kind: "register",
      message:
        "Completa y envía tu postulación. Después deberás completar un challenge con una evaluación oficial.",
      command: "andes register",
    };
  }
  const { registration, requirements } = result;
  if (
    registration.status === "rejected" ||
    registration.status === "withdrawn"
  ) {
    return {
      kind: "register",
      message: "Puedes enviar una nueva postulación.",
      command: "andes register",
    };
  }
  if (registration.status === "accepted") {
    if (requirements.stage === "complete") {
      return {
        kind: "badge",
        message:
          "Tu asistencia está confirmada. Generaremos tu carnet automáticamente. Consulta el resultado y comparte tu carnet.",
        command: "andes badge",
      };
    }
    return {
      kind: "confirm",
      message:
        "Tu postulación fue aceptada. Falta confirmar tu asistencia y completar tus datos de ingreso. Al terminar generaremos tu carnet automáticamente.",
      command: "andes confirm",
    };
  }
  if (requirements.stage === "draft") {
    return {
      kind: "register",
      message:
        "Tu postulación todavía es un borrador. Completa los datos y envíala.",
      command: "andes register",
    };
  }
  const evaluated = registration.challenges.find(
    (challenge) => challenge.playable && challenge.status === "evaluated",
  );
  if (evaluated) {
    let message =
      "Tu evaluación oficial está registrada. Todavía falta la decisión sobre tu postulación. Te avisaremos por correo; también puedes consultar tu estado aquí.";
    if (registration.status === "waitlisted") {
      message =
        "Tu evaluación oficial está registrada y estás en lista de espera. Te avisaremos por correo si se libera un cupo.";
    }
    return { kind: "decision", message, command: "andes status" };
  }
  const available = registration.challenges.filter(
    (challenge) =>
      challenge.playable &&
      challenge.open &&
      !challenge.closed &&
      challenge.evaluationsUsed < challenge.evaluationsLimit,
  );
  const challenge =
    available.find((item) => item.status === "in_progress") ?? available[0];
  if (challenge) {
    if (challenge.status === "in_progress") {
      return {
        kind: "challenge_continue",
        challengeSlug: challenge.slug,
        message: `Tu postulación está enviada, pero falta completar ${challenge.theme} con una evaluación oficial. Revisa tu progreso y prepara el envío. Los tests públicos no completan este paso.`,
        command: `andes challenge show --challenge ${challenge.slug}`,
      };
    }
    return {
      kind: "challenge_start",
      challengeSlug: challenge.slug,
      message: `Tu postulación está enviada, pero falta el challenge obligatorio. Empieza ${challenge.theme}, resuélvelo y envía una evaluación oficial para competir por un cupo.`,
      command: `andes challenge init --challenge ${challenge.slug}`,
    };
  }
  return {
    kind: "challenge_unavailable",
    message:
      "Todavía necesitas una evaluación oficial para competir por un cupo, pero no hay un challenge abierto con evaluaciones disponibles. Consulta las fechas y los challenges disponibles.",
    command: "andes challenge list",
  };
};

export const nextStepText = (step: NextStep): string =>
  ["SIGUIENTE PASO", step.message, `Siguiente comando: ${step.command}`].join(
    "\n",
  );

export const withRegistrationNextStep = <R>(
  operation: Effect.Effect<ApiSuccess<RegistrationResult>, CliError, R>,
) =>
  operation.pipe(
    Effect.map((response) => ({
      ...response,
      data: { ...response.data, nextStep: nextStepFor(response.data) },
    })),
  );

export interface ParticipantGuidance {
  readonly registration?: RegistrationResult;
  readonly nextStep: NextStep;
}

export const loadParticipantGuidance = (
  client: ApiClientOptions,
): Effect.Effect<ApiSuccess<ParticipantGuidance>, CliError> =>
  getRegistration(client).pipe(
    Effect.map((response) => ({
      ...response,
      data: {
        registration: response.data,
        nextStep: nextStepFor(response.data),
      },
    })),
    Effect.catch((error) => {
      if (
        error.code !== "REGISTRATION_NOT_FOUND" &&
        error.code !== "AUTHENTICATION_REQUIRED"
      ) {
        return Effect.fail(error);
      }
      let nextStep = nextStepFor();
      if (error.code === "AUTHENTICATION_REQUIRED") {
        nextStep = {
          kind: "login",
          message:
            "Inicia sesión para consultar tu avance y continuar tu postulación.",
          command: "andes login",
        };
      }
      return Effect.succeed({
        version: 1 as const,
        ok: true as const,
        requestId: error.requestId,
        data: { nextStep },
      });
    }),
  );
