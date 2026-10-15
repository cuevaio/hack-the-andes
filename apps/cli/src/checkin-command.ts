import { Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import QRCode from "qrcode";
import { createCheckin, getCheckin } from "./api-client.js";
import { waitForCheckin } from "./checkin-wait.js";
import { root } from "./cli-root.js";
import { cliError } from "./errors.js";
import { execute } from "./output.js";

export const checkinCommand = Command.make(
  "checkin",
  {
    status: Flag.boolean("status").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Consultar asistencia sin generar otro QR"),
    ),
    noWait: Flag.boolean("no-wait").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Mostrar el QR sin esperar la confirmación"),
    ),
  },
  ({ status, noWait }) =>
    Effect.gen(function* () {
      const options = yield* root;
      const client = {
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      };
      yield* execute(
        options.output,
        Effect.gen(function* () {
          if (status) return yield* getCheckin(client);
          const issued = yield* createCheckin(client);
          if (issued.data.checkedIn || options.output === "json") return issued;
          const token = issued.data.token;
          if (!token)
            return yield* cliError(
              "INVALID_API_RESPONSE",
              "No se recibió el código de check-in.",
            );
          // A URL fragment avoids sending the bearer code to page access logs/referrers.
          const url = new URL("/admin/checkin", options.apiUrl);
          url.hash = new URLSearchParams({ token }).toString();
          const qr = yield* Effect.tryPromise({
            try: () =>
              QRCode.toString(url.toString(), {
                type: "terminal",
                small: true,
              }),
            catch: () => cliError("QR_ERROR", "No se pudo generar el QR."),
          });
          yield* Effect.sync(() =>
            process.stderr.write(
              `\n${qr}\nMuestra este QR al equipo de ingreso.\nCódigo alternativo: ${token.match(/.{1,4}/g)?.join("-")}\nVence: ${issued.data.expiresAt}\n`,
            ),
          );
          if (noWait || !process.stdout.isTTY) return issued;
          yield* Effect.sync(() =>
            process.stderr.write(
              "Esperando confirmación de la organización…\n",
            ),
          );
          return yield* waitForCheckin(() => getCheckin(client));
        }),
        (checkin) => {
          if (checkin.checkedIn)
            return "Check-in confirmado. ¡Bienvenido a Hack the Andes!";
          return "Todavía no tienes check-in. La organización debe verificar tu llegada. Consulta con andes checkin --status.";
        },
      );
    }),
).pipe(
  Command.withDescription(
    "Mostrar tu QR para que la organización confirme tu llegada",
  ),
);
