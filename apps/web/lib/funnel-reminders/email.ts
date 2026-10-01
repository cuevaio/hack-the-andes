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
}

interface SendFunnelReminderEmailInput extends FunnelReminderEmailInput {
  readonly clerkUserId: string;
  readonly deliveryScope: string;
}

const copyFor = (stage: FunnelReminderStage) => {
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
    };
  }

  if (stage === "challenge_start") {
    return {
      subject:
        "Tu postulación está lista. Ahora demuestra lo que puedes construir",
      preheader: "Empieza el challenge de clasificación de Hack the Andes.",
      eyebrow: "SIGUIENTE PASO / EMPEZAR",
      heading: "Entra al challenge.",
      introduction:
        "Tu postulación ya está en carrera. El challenge es tu oportunidad de demostrar cómo piensas, construyes y resuelves problemas reales junto a una comunidad excepcional.",
      action: "Empezar el challenge",
      url: "https://hacktheandes.com/challenges/black-box?utm_source=resend&utm_medium=email&utm_campaign=funnel&utm_content=challenge_start",
      command: "andes challenge init",
    };
  }

  return {
    subject: "Ya empezaste el challenge. Ahora termínalo",
    preheader: "Convierte tu avance en una evaluación oficial.",
    eyebrow: "SIGUIENTE PASO / TERMINAR",
    heading: "Llévalo hasta el final.",
    introduction:
      "Ya abriste la caja y empezaste a investigar. No dejes tu trabajo a medias: envía una evaluación oficial y demuestra que tienes lo necesario para construir lo que el Perú necesita.",
    action: "Terminar el challenge",
    url: "https://hacktheandes.com/challenges/black-box?utm_source=resend&utm_medium=email&utm_campaign=funnel&utm_content=challenge_finish",
    command: "andes challenge evaluate --source ./shipping.js",
  };
};

const experience =
  "Vas camino a formar parte de un grupo exclusivo de hackers que construirá lo que el Perú necesita. Te esperan más de S/ 8,000 en premios, apoyo con vuelos a Lima para personas con habilidades excepcionales de otras partes del Perú, comida, bebidas, energy drinks, merch y una experiencia increíble.";

export const buildFunnelReminderEmail = (
  input: FunnelReminderEmailInput,
): FunnelReminderEmail => {
  const copy = copyFor(input.stage);
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
    `O desde tu terminal: ${copy.command}`,
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
      command("O desde tu terminal", copy.command),
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
