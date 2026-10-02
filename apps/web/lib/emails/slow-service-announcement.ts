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

export const slowServiceCampaign = "slow-service-v3";
export const slowServiceGuideUrl =
  "https://hacktheandes.com/challenges/make-it-fast?utm_source=resend&utm_medium=email&utm_campaign=slow-service-v3&utm_content=launch";
export const slowServiceInitCommand =
  "chofex challenge init --challenge make-it-fast";

export function buildSlowServiceAnnouncement() {
  const subject =
    "El servicio lento: trabaja con tu agente y revisa la solución";
  const introduction =
    "Ya puedes resolver The Slow Service, el tercer challenge de Hack the Andes. Haz más eficiente un servicio de diario contable que recibe pagos y correcciones.";
  const instructions =
    "Cada respuesta debe ser exacta. Respeta las revisiones optimistas y rechaza sin modificar nada las correcciones retroactivas que produzcan saldos negativos en cualquier cuenta. Conserva los saldos y la distribución de pagos en los reportes de estados anteriores.";
  const reporting =
    "Calcula percentiles exactos de los importes de débito, las partidas negativas. Los créditos no entran en esa distribución. El puntaje combina correctitud y uso de CPU, hasta 100 puntos.";
  const companion =
    "Trabaja con tu agente. Puede escribir todo el código y ejecutar los tests. Antes de evaluar, lee la revisión vinculada al código que vas a enviar y valida un caso concreto de falla. Después, aprueba esa versión en tu navegador con tu passkey. Si cambias el código, revisa y aprueba de nuevo.";
  const history =
    "El challenge 2, The Scheduler, ya cerró. Tu historial y su ranking se conservan.";
  const privacy =
    "Recibes este aviso porque tienes una cuenta en Hack the Andes. Para dejar de recibir anuncios de challenges, responde a este correo.";
  const unsubscribe = `mailto:${emailAddresses.reply_to}?subject=Baja%20de%20anuncios%20de%20challenges`;
  const text = [
    "Hola,",
    "",
    introduction,
    "",
    instructions,
    "",
    reporting,
    "",
    companion,
    "",
    `Ver el challenge: ${slowServiceGuideUrl}`,
    `Empieza en tu terminal: ${slowServiceInitCommand}`,
    "",
    history,
    "",
    privacy,
    `Solicitar la baja: ${unsubscribe}`,
    "",
    "El equipo de Hack the Andes",
  ].join("\n");
  const html = emailShell({
    subject,
    preheader:
      "Tu agente implementa y prueba. Tú revisas un caso de falla y apruebas la versión antes de evaluar.",
    stamp: "03",
    blocks: [
      eyebrow("MAKE IT FAST / ABIERTO"),
      heading("The Slow Service"),
      paragraph("Hola,"),
      paragraph(introduction),
      paragraph(instructions),
      paragraph(reporting),
      paragraph(companion),
      button("Ver el challenge", slowServiceGuideUrl),
      command("Empieza en tu terminal", slowServiceInitCommand),
      paragraph(history),
      paragraph(privacy),
      `<tr><td style="padding:0 38px 24px"><a href="${escapeHtml(unsubscribe)}" style="color:#b5b6ae;font-family:Arial,Helvetica,sans-serif;font-size:12px">Solicitar la baja de anuncios</a></td></tr>`,
    ],
  });
  // The shared transactional configuration includes CC. Campaign recipients
  // must stay private, so only reuse the sender and reply inbox.
  return {
    from: emailAddresses.from,
    reply_to: emailAddresses.reply_to,
    subject,
    text,
    html,
    headers: { "List-Unsubscribe": `<${unsubscribe}>` },
  };
}
