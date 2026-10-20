import { renderCertificate } from "@/lib/certificates/render";
import { findCertificate } from "@/lib/certificates/service";
import { HttpError, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; format: string }> },
) {
  return withApiHandler(request, async () => {
    const { id, format } = await context.params;
    if (format !== "certificate.pdf" && format !== "certificate.png")
      throw new HttpError(404, "NOT_FOUND", "Archivo no encontrado.");
    const certificate = await findCertificate(id);
    if (certificate?.status !== "valid")
      throw new HttpError(
        404,
        "CERTIFICATE_NOT_VALID",
        "El certificado no existe o ya no es válido.",
      );
    let kind: "pdf" | "png" = "png";
    if (format === "certificate.pdf") kind = "pdf";
    const bytes = await renderCertificate(certificate, kind);
    let disposition = "inline";
    if (kind === "pdf" || new URL(request.url).searchParams.has("download"))
      disposition = "attachment";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": kind === "pdf" ? "application/pdf" : "image/png",
        "content-disposition": `${disposition}; filename="${id}.${kind}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });
}
