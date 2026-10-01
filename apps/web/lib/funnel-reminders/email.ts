import type { ChallengeDefinition } from "@chofex/challenges-contract";

import { emailAddresses } from "@/lib/emails/config";
import {
  button,
  command,
  emailShell,
  eyebrow,
  heading,
  paragraph,
} from "@/lib/emails/layout";

import type { FunnelReminderRecipient, FunnelReminderStage } from "./types";

interface FunnelReminderEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

interface FunnelReminderEmailInput extends FunnelReminderRecipient {
  readonly stage: FunnelReminderStage;
  readonly challenge?: ChallengeDefinition;
}

interface SendFunnelReminderEmailInput extends FunnelReminderEmailInput {
  readonly clerkUserId: string;
  readonly deliveryScope: string;
}

const copyFor = (
  stage: FunnelReminderStage,
  challenge?: ChallengeDefinition,
) => {
  if (stage === "registration") {
    return {
      subject: "Tu lugar en Hack the Andes empieza aquí",
      preheader: "Envía tu postulación y da el siguiente paso.",
      eyebrow: "SIGUIENTE PASO / POSTULAR",
      heading: "Hazlo oficial.",
      introduction:
        "Ya diste el primer paso al entrar. Ahora completa y envía tu postulación para acercarte al grupo de hackers que construirá lo que el Perú necesita.",
      action: "Enviar mi postulación",
      url: "https://hacktheandes.com/?utm_source=resend&utm_medium=email&utm_campaign=funnel&utm_content=registration#apply",
      command: "andes register",
      instructions:
        "Abre una terminal en tu computadora y ejecuta el comando. Si necesitas iniciar sesión, ejecuta andes login y luego repite andes register. Después de enviar la postulación debes completar un challenge con una evaluación oficial para competir por un cupo. Ejecuta andes para ver tu siguiente paso.",
    };
  }

  if (!challenge)
    throw new Error("A challenge reminder requires an open challenge");
  const challengeUrl = `https://hacktheandes.com/challenges/${challenge.slug}?utm_source=resend&utm_medium=email&utm_campaign=funnel&utm_content=${stage}`;
  const initCommand = `andes challenge init --challenge ${challenge.slug}`;
  const showCommand = `andes challenge show --challenge ${challenge.slug}`;

  if (stage === "challenge_start") {
    return {
      subject:
        "Tu postulación está lista. Ahora demuestra lo que puedes construir",
      preheader: "Empieza el challenge de clasificación de Hack the Andes.",
      eyebrow: "SIGUIENTE PASO / EMPEZAR",
      heading: "Entra al challenge.",
      introduction:
        "Recibimos tu postulación, pero todavía falta el challenge obligatorio. Enviar la postulación no reserva un cupo. Necesitas una evaluación oficial; los tests públicos por sí solos no completan este paso.",
      action: "Empezar el challenge",
      url: challengeUrl,
      command: initCommand,
      instructions: `Abre una terminal en tu computadora y ejecuta el comando para crear los archivos de ${challenge.theme}. Lee el README, resuelve el challenge y sigue la guía de andes challenge. Para revisar tu progreso: ${showCommand}. Si necesitas iniciar sesión, ejecuta andes login. Si ya avanzaste, ejecuta andes para ver tu siguiente paso.`,
    };
  }

  let instructions =
    "Prueba tu solución con andes challenge test --challenge black-box --source ./shipping.js. Cuando esté lista, ejecuta andes challenge evaluate --challenge black-box --source ./shipping.js. Después ejecuta andes status para consultar la decisión; si te aceptan, el siguiente paso será andes confirm.";
  if (challenge.slug === "broken-agent") {
    instructions =
      "Desde la carpeta broken-agent, prueba tu solución con andes challenge test --challenge broken-agent --source ./scheduler.js. Prepara review.json con tu propia revisión y ejecuta andes challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json. Abre personalmente el enlace de aprobación en tu navegador y luego repite el mismo comando para registrar la evaluación oficial. Después ejecuta andes status para consultar la decisión; si te aceptan, el siguiente paso será andes confirm.";
  }
  return {
    subject: "Ya empezaste el challenge. Ahora termínalo",
    preheader: "Convierte tu avance en una evaluación oficial.",
    eyebrow: "SIGUIENTE PASO / TERMINAR",
    heading: "Llévalo hasta el final.",
    introduction:
      "Ya empezaste el challenge, pero todavía no tienes una evaluación oficial registrada. Revisa tu progreso y completa el envío para competir por un cupo.",
    action: "Terminar el challenge",
    url: challengeUrl,
    command: showCommand,
    instructions,
  };
};

const experience =
  "Vas camino a formar parte de un grupo exclusivo de hackers que construirá lo que el Perú necesita. Te esperan más de S/ 8,000 en premios, apoyo con vuelos a Lima para personas con habilidades excepcionales de otras partes del Perú, comida, bebidas, energy drinks, merch y una experiencia increíble.";

export const buildFunnelReminderEmail = (
  input: FunnelReminderEmailInput,
): FunnelReminderEmail => {
  const copy = copyFor(input.stage, input.challenge);
  const firstName = input.firstName.trim();
  const greeting = firstName ? `Hola ${firstName},` : "Hola,";
  const text = [
    greeting,
    "",
    copy.introduction,
    "",
    experience,
    "",
    `${copy.action}: ${copy.url}`,
    `Siguiente comando en tu terminal: ${copy.command}`,
    "",
    copy.instructions,
    "",
    "Nos vemos en la cima.",
    "— El equipo de Hack the Andes",
  ].join("\n");

  const html = emailShell({
    subject: copy.subject,
    preheader: copy.preheader,
    // Nothing to stamp on somebody who has no card yet.
    stamp: "17–18 OCT 2026",
    blocks: [
      eyebrow(copy.eyebrow),
      heading(copy.heading),
      paragraph(greeting),
      paragraph(copy.introduction),
      paragraph(experience),
      button(copy.action, copy.url),
      command("Siguiente comando en tu terminal", copy.command),
      paragraph(copy.instructions),
    ],
  });

  return { subject: copy.subject, text, html };
};

export const sendFunnelReminderEmail = async (
  input: SendFunnelReminderEmailInput,
): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const email = buildFunnelReminderEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `funnel-reminder/${input.stage}/${input.clerkUserId}/${input.deliveryScope}`,
    },
    body: JSON.stringify({
      ...emailAddresses,
      to: [input.email],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (response.ok) return;
  const body = (await response.json().catch(() => undefined)) as
    | { readonly message?: string }
    | undefined;
  throw new Error(body?.message ?? `Resend returned HTTP ${response.status}`);
};
