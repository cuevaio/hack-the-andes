import { Command, Flag } from "effect/unstable/cli";

import { eventName } from "./brand.js";
import { config } from "./config.js";
import { cliCommandName } from "./metadata.js";

export const rootValueFlagNames = {
  apiUrl: "api-url",
  output: "output",
  token: "token",
} as const;

export const root = Command.make(cliCommandName).pipe(
  Command.withSharedFlags({
    apiUrl: Flag.string(rootValueFlagNames.apiUrl).pipe(
      Flag.withDefault(config.apiUrl),
      Flag.withDescription("Chofex API base URL"),
    ),
    output: Flag.choice(rootValueFlagNames.output, ["human", "json"]).pipe(
      Flag.withDefault("human"),
      Flag.withDescription("Output format"),
    ),
    token: Flag.string(rootValueFlagNames.token).pipe(
      Flag.optional,
      Flag.withDescription(
        "Clerk OAuth token (prefer CHOFEX_TOKEN to avoid shell history)",
      ),
    ),
  }),
  Command.withDescription(
    `Apply to ${eventName} and compete for a seat through the mandatory technical challenges`,
  ),
);
