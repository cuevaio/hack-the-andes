import { requireAuthenticatedParticipant } from "@/lib/auth";
import { certificateUrl } from "@/lib/certificates/links";
import { issueCertificate } from "@/lib/certificates/service";
import {
  HttpError,
  jsonSuccess,
  withApiHandler,
} from "@/lib/registration/http";

export const runtime = "nodejs";
export const POST = (request: Request) =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipant(request);
    const certificate = await issueCertificate(participant.clerkUserId);
    if (certificate.status !== "valid")
      throw new HttpError(
        403,
        "CERTIFICATE_REVOKED",
        "Este certificado no es válido. Comunícate con la organización.",
      );
    return jsonSuccess(requestId, {
      certificate,
      url: certificateUrl(certificate.id),
    });
  });
