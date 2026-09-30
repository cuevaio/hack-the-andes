import {
  button,
  command,
  emailShell,
  eyebrow,
  heading,
  note,
  paragraph,
  picture,
} from "@/lib/emails/layout";

export type ApplicationDecision = "accepted" | "rejected";

interface DecisionEmailInputBase {
  readonly firstName: string;
  readonly message?: string;
}

interface AcceptedDecisionEmailInput extends DecisionEmailInputBase {
  readonly decision: "accepted";
  readonly badgeUrl: string;
  readonly badgePageUrl: string;
  readonly placement: string;
}

interface RejectedDecisionEmailInput extends DecisionEmailInputBase {
  readonly decision: "rejected";
}

export type DecisionEmailInput =
  | AcceptedDecisionEmailInput
  | RejectedDecisionEmailInput;

export interface DecisionEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** The primary action, available on mobile as well as through the CLI. */
const CONFIRM_URL =
  "https://hacktheandes.com/welcome?utm_source=resend&utm_medium=email&utm_campaign=decision&utm_content=confirm";

const APPLY_URL =
  "https://hacktheandes.com/?utm_source=resend&utm_medium=email&utm_campaign=decision&utm_content=reapply#apply";

const transportSupport = {
  title: "Apoyo para transporte",
  body: "Si viajas a Lima desde otra ciudad del Perú y necesitas apoyo económico para tus pasajes, completa este formulario. Cuéntanos cuánto cuesta tu viaje de ida y vuelta y cuánto puedes cubrir por tu cuenta. Priorizaremos a quienes no podrían participar por el costo del transporte.",
  conditions:
    "El apoyo es solo para viajes dentro del Perú y está sujeto al presupuesto disponible. Completar el formulario no garantiza recibir apoyo. Nos comunicaremos directamente con las personas seleccionadas.",
  action: "Solicitar apoyo",
  url: "https://forms.gle/TEHC6uc7PWeuwbKi6",
};

const decisionCopy = (decision: ApplicationDecision) => {
  if (decision === "accepted") {
    return {
      subject: "Estás dentro — bienvenida a Hack the Andes",
      preheader:
        "Tu postulación fue aprobada. Confirma tu asistencia para asegurar tu lugar.",
      eyebrow: "POSTULACIÓN APROBADA",
      heading: "Estás dentro.",
      introduction:
        "Nos alegra ofrecerte un lugar en Hack the Andes, en Lima, el 17 y 18 de octubre.",
      body: "Este es tu carnet predeterminado, hecho con el nombre, la foto y la presentación que vimos en tu postulación. Completa chofex confirm aunque quieras conservarlo: necesitamos tu nombre completo y DNI o pasaporte para autorizar tu ingreso al venue. Comparte también tu teléfono para que podamos contactarte por WhatsApp si hace falta. En ese mismo paso puedes cambiar el nombre del carnet, la foto y la presentación de una línea; al terminar generaremos uno nuevo.",
      action: "Confirmar mi asistencia",
      url: CONFIRM_URL,
      commandLabel: "O desde tu terminal:",
      command: "chofex confirm",
    };
  }

  return {
    subject: "Una actualización sobre tu postulación",
    preheader: "Gracias por postular a Hack the Andes.",
    eyebrow: "ACTUALIZACIÓN DE POSTULACIÓN",
    heading: "Gracias por postular.",
    introduction:
      "Después de revisarla con cuidado, esta vez no podemos ofrecerte un lugar en Hack the Andes.",
    body: "Valoramos el tiempo y el trabajo que le pusiste. Puedes volver a postular con una nueva postulación cuando quieras.",
    action: "Volver a postular",
    url: APPLY_URL,
    commandLabel: "O desde tu terminal:",
    command: "chofex register",
  };
};

export const buildDecisionEmail = (
  input: DecisionEmailInput,
): DecisionEmail => {
  const copy = decisionCopy(input.decision);
  const name = input.firstName.trim();
  const greeting = name ? `Hola ${name},` : "Hola,";

  const badgeText: string[] = [];
  if (input.decision === "accepted") {
    badgeText.push("", `Mi carnet (${input.placement}): ${input.badgePageUrl}`);
  }
  const sharing =
    "Celebra este logro compartiendo tu carnet en LinkedIn e Instagram.";
  const acceptedNextSteps: string[] = [];
  if (input.decision === "accepted") {
    acceptedNextSteps.push(
      "",
      sharing,
      "",
      transportSupport.title,
      transportSupport.body,
      transportSupport.conditions,
      `${transportSupport.action}: ${transportSupport.url}`,
    );
  }

  const text = [
    greeting,
    "",
    copy.introduction,
    "",
    copy.body,
    ...badgeText,
    "",
    `${copy.action}: ${copy.url}`,
    `${copy.commandLabel} ${copy.command}`,
    ...acceptedNextSteps,
    ...(input.message
      ? ["", "Una nota del equipo de revisión:", input.message]
      : []),
    "",
    "Nos vemos en la cima.",
    "— El equipo de Hack the Andes",
  ].join("\n");

  const blocks = [
    eyebrow(copy.eyebrow),
    heading(copy.heading),
    paragraph(greeting),
    paragraph(copy.introduction),
  ];
  if (input.decision === "accepted") {
    blocks.push(
      picture(
        input.badgeUrl,
        "Tu carnet de Hack the Andes",
        input.badgePageUrl,
      ),
    );
  }
  blocks.push(
    paragraph(copy.body),
    button(copy.action, copy.url),
    command(copy.commandLabel, copy.command),
  );
  if (input.decision === "accepted") {
    blocks.push(
      paragraph(sharing),
      note(transportSupport.title, transportSupport.body),
      paragraph(transportSupport.conditions),
      button(transportSupport.action, transportSupport.url),
    );
  }
  if (input.message) {
    blocks.push(note("Una nota del equipo de revisión", input.message));
  }

  const html = emailShell({
    subject: copy.subject,
    preheader: copy.preheader,
    stamp: input.decision === "accepted" ? input.placement : "17–18 OCT 2026",
    ridge: input.decision !== "accepted",
    blocks,
  });

  return { subject: copy.subject, text, html };
};
