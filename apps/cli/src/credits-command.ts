import type { Credits } from "@chofex/registration-contract";
import { Effect, Option } from "effect";
import { Command } from "effect/unstable/cli";
import { getCredits } from "./api-client.js";
import { root } from "./cli-root.js";
import { execute } from "./output.js";
import { terminalName } from "./team-output.js";

export const creditsText = ({ credits }: Credits): string =>
  credits
    .map((credit) => {
      const lines = [credit.sponsor, credit.benefit];
      if (credit.code) lines.push(`Código: ${credit.code}`);
      if (credit.url) lines.push(`Canjear: ${credit.url}`);
      lines.push(...credit.instructions);
      return lines.map(terminalName).join("\n");
    })
    .join("\n\n");

export const creditsCommand = Command.make("credits", {}, () =>
  Effect.gen(function* () {
    const options = yield* root;
    yield* execute(
      options.output,
      getCredits({
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      }),
      creditsText,
    );
  }),
).pipe(
  Command.withDescription(
    "Consultar créditos y beneficios disponibles después del check-in",
  ),
);
