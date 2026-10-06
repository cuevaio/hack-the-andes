import { emailAddresses } from "./config";
import {
  button,
  command,
  emailShell,
  escapeHtml,
  eyebrow,
  heading,
  paragraph,
} from "./layout";

export const powerGridAnnouncementCampaign =
  "power-grid-v1-launch-announcement";
export const powerGridAnnouncementUrl =
  "https://hacktheandes.com/challenges/power-grid?utm_source=resend&utm_medium=email&utm_campaign=power-grid-v1-launch-announcement&utm_content=invitation";

export function buildPowerGridAnnouncement() {
  const subject =
    "Power Grid ya está abierto: participa en el cuarto challenge";
  const introduction =
    "Power Grid, el cuarto challenge de Hack the Andes, ya está abierto. Te invitamos a participar y trabajar junto con tu agente. Una cooperativa perdió el código de su facturador eléctrico y solo conserva un servicio que recibe lecturas y devuelve un importe. Tu misión será descubrir sus reglas y reemplazarlo con tu propia función.";
  const limits =
    "Tendrás 25 consultas y 3 evaluaciones oficiales. Las tarifas son ficticias: no necesitas conocimientos de electricidad. Los tests gratuitos comparan tu solución con las observaciones que ya recogiste; no garantizan el puntaje oculto.";
  const collaboration =
    "Trabaja junto con tu agente. Tú eliges qué hipótesis investigar, revisas los resultados y decides cuándo continuar. El agente debe pedirte dirección entre rondas, usar como máximo tres consultas nuevas por ronda y preguntarte antes de cada evaluación oficial.";
  const availability =
    "Actualiza la CLI y el skill con andes update. Después ejecuta andes challenge init --challenge power-grid, entra a la carpeta power-grid y lee README.md y AGENTS.md con tu agente antes de empezar.";
  const congratulations =
    "¡Felicidades a quienes consiguieron su cupo con el tercer challenge! Invitamos a todos los participantes a seguir trabajando con sus agentes y probar este nuevo reto.";
  const event = "Nos vemos el 17 y 18 de octubre en Lima.";
  const privacy =
    "Recibes este aviso porque tienes una cuenta en Hack the Andes. Para dejar de recibir anuncios de challenges, responde a este correo.";
  const unsubscribe = `mailto:${emailAddresses.reply_to}?subject=Baja%20de%20anuncios%20de%20challenges`;
  const text = [
    "Hola,",
    "",
    introduction,
    "",
    limits,
    "",
    collaboration,
    "",
    availability,
    "",
    `Ver la guía: ${powerGridAnnouncementUrl}`,
    "Actualiza la CLI y el skill: andes update",
    "Empieza: andes challenge init --challenge power-grid",
    "",
    congratulations,
    "",
    event,
    "",
    privacy,
    `Solicitar la baja: ${unsubscribe}`,
    "",
    "El equipo de Hack the Andes",
  ].join("\n");
  const html = emailShell({
    subject,
    preheader:
      "Descubre las reglas del facturador junto con tu agente. 25 consultas y 3 evaluaciones.",
    stamp: "04",
    blocks: [
      eyebrow("POWER GRID / ABIERTO"),
      heading("Power Grid"),
      paragraph("Hola,"),
      paragraph(introduction),
      paragraph(limits),
      paragraph(collaboration),
      paragraph(availability),
      button("Conocer el challenge", powerGridAnnouncementUrl),
      command("Actualiza la CLI y el skill", "andes update"),
      command(
        "Empieza en tu terminal",
        "andes challenge init --challenge power-grid",
      ),
      paragraph(congratulations),
      paragraph(event),
      paragraph(privacy),
      `<tr><td style="padding:0 38px 24px"><a href="${escapeHtml(unsubscribe)}" style="color:#b5b6ae;font-family:Arial,Helvetica,sans-serif;font-size:12px">Solicitar la baja de anuncios</a></td></tr>`,
    ],
  });
  return {
    from: emailAddresses.from,
    reply_to: emailAddresses.reply_to,
    subject,
    text,
    html,
    headers: { "List-Unsubscribe": `<${unsubscribe}>` },
  };
}
