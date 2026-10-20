import type { ParticipationCertificate } from "@chofex/registration-contract";
import { escapeHtml } from "../emails/layout";
import { certificateUrl } from "./links";

export function certificateEmail(certificate: ParticipationCertificate) {
  const subject = "¡Felicitaciones por participar en Hack the Andes!";
  const url = certificateUrl(certificate.id);
  const greeting = `Hola ${certificate.recipientName},`;
  const congratulations =
    "¡Felicitaciones por tu participación en Hack the Andes! Gracias por compartir tu talento, construir en equipo y ser parte de esta edición en Lima, el 17 y 18 de octubre de 2026.";
  const attachment =
    "Te adjuntamos tu certificado de participación en PDF, firmado por Shiara Arauzo y Anthony Cueva.";
  const access =
    "En tu página puedes verificar el certificado, descargarlo y encontrar los datos para añadirlo a LinkedIn.";
  const cli =
    "También puedes obtener tu enlace desde el CLI. Actualiza y ejecuta:";
  const account =
    "Usa la misma cuenta con la que participaste. Si necesitas iniciar sesión, ejecuta andes login.";
  const text = [
    greeting,
    congratulations,
    attachment,
    access,
    url,
    cli,
    "andes update\nandes certificate",
    account,
    `ID: ${certificate.id}`,
    "Gracias por construir con nosotros.\nEl equipo de Hack the Andes",
  ].join("\n\n");
  const paragraph = (value: string) =>
    `<p style="margin:0 0 22px;color:#bcbcbc;font-size:16px;line-height:1.7">${escapeHtml(value)}</p>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#000;color:#fff;font-family:Arial,Helvetica,sans-serif"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:40px 20px"><div style="max-width:600px;margin:auto"><img src="https://hacktheandes.com/brand/hack-the-andes-light.png" width="250" alt="Hack the Andes" style="display:block;max-width:100%;height:auto;margin-bottom:48px"><h1 style="font-size:32px;font-weight:500;line-height:1.2;margin:0 0 32px">¡Felicitaciones!</h1>${paragraph(greeting)}${paragraph(congratulations)}${paragraph(attachment)}${paragraph(access)}<p style="margin:32px 0"><a href="${url}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;padding:15px 24px;border-radius:28px;font-size:15px">Ver mi certificado</a></p>${paragraph(cli)}<pre style="white-space:pre-wrap;padding:20px;background:#161616;border-radius:10px;color:#fff;font:15px/1.8 monospace">andes update\nandes certificate</pre>${paragraph(account)}<p style="font-size:12px;color:#777;word-break:break-all;margin:32px 0">ID: ${certificate.id}<br><a style="color:#aaa" href="${url}">${url}</a></p>${paragraph("Gracias por construir con nosotros.")}<p style="font-size:15px;color:#fff">El equipo de Hack the Andes</p></div></td></tr></table></body></html>`;
  return { subject, text, html };
}
