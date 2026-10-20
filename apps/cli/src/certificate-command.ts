import type { CertificateReceipt } from "@chofex/registration-contract";
import { Effect, Option } from "effect";
import { Command } from "effect/unstable/cli";
import { getCertificate } from "./api-client.js";
import { root } from "./cli-root.js";
import { execute } from "./output.js";
import { terminalName } from "./team-output.js";

export const certificateText = ({
  certificate,
  url,
}: CertificateReceipt): string =>
  [
    `Certificado de participación · ${terminalName(certificate.recipientName)}`,
    `ID: ${certificate.id}`,
    "",
    terminalName(url),
    "",
    "Abre el enlace para descargar tu certificado o añadirlo a LinkedIn.",
  ].join("\n");

export const certificateCommand = Command.make("certificate", {}, () =>
  Effect.gen(function* () {
    const options = yield* root;
    yield* execute(
      options.output,
      getCertificate({
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      }),
      certificateText,
    );
  }),
).pipe(
  Command.withDescription(
    "Obtener el enlace de tu certificado de participación después del check-in",
  ),
  Command.withExamples([
    {
      command: "andes certificate",
      description: "Obtener tu certificado y su enlace público",
    },
  ]),
);
