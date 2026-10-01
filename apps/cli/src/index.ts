#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { CliOutput, Command } from "effect/unstable/cli";

import { command } from "./commands.js";
import { cliVersion } from "./metadata.js";
import { printJson } from "./output.js";
import {
  autoUpdateCli,
  cliPackageName,
  isStandaloneExecutable,
  runUpdatedCli,
  shouldAutoUpdateCli,
} from "./upgrade.js";
import { welcomeFormatter } from "./welcome.js";

const arguments_ = process.argv.slice(2);

const jsonOutputRequested = (arguments_: ReadonlyArray<string>): boolean => {
  if (arguments_.includes("--output=json")) return true;
  const outputFlag = arguments_.lastIndexOf("--output");
  return outputFlag >= 0 && arguments_[outputFlag + 1] === "json";
};

const jsonMode = jsonOutputRequested(arguments_);
const jsonHelpRequested =
  jsonMode && (arguments_.includes("--help") || arguments_.includes("-h"));
const jsonVersionRequested =
  jsonMode && (arguments_.includes("--version") || arguments_.includes("-v"));

const quietConsole: Console.Console = Object.assign(Object.create(console), {
  log: () => undefined,
  error: () => undefined,
});

const commandProgram = command.pipe(
  Command.run({ version: cliVersion, renderErrors: !jsonMode }),
  Effect.provide(
    CliOutput.layer(
      welcomeFormatter({
        columns: process.stdout.columns ?? 80,
        colors:
          process.stdout.isTTY === true &&
          process.env.NO_COLOR === undefined &&
          process.env.TERM !== "dumb",
      }),
    ),
  ),
  Effect.catch((error) => {
    if (!jsonMode) return Effect.fail(error);
    if (error._tag === "ShowHelp" && error.errors.length === 0) {
      return printJson({
        version: 1,
        ok: true,
        requestId: crypto.randomUUID(),
        data: {
          helpRequested: true,
          commandPath: error.commandPath,
          hint: "Run without --output json to view formatted help",
        },
      });
    }
    process.exitCode = 2;
    const errors = error._tag === "ShowHelp" ? error.errors : [error];
    return printJson({
      version: 1,
      ok: false,
      requestId: crypto.randomUUID(),
      error: {
        code: "CLI_PARSE_ERROR",
        message: errors.map((item) => item.message).join("; "),
        retryable: false,
        details: { types: errors.map((item) => item._tag) },
      },
    });
  }),
  (program) => {
    if (!jsonMode) return program;
    return Effect.provideService(program, Console.Console, quietConsole);
  },
);

const programForArguments = () => {
  if (jsonVersionRequested) {
    return printJson({
      version: 1,
      ok: true,
      requestId: crypto.randomUUID(),
      data: { cliVersion },
    });
  }
  if (jsonHelpRequested) {
    return printJson({
      version: 1,
      ok: true,
      requestId: crypto.randomUUID(),
      data: {
        helpRequested: true,
        hint: "Run without --output json to view formatted help",
      },
    });
  }
  return commandProgram;
};

type AutomaticUpdateOutcome = "command-completed" | "continue";

const runAutomaticUpdate = async (): Promise<AutomaticUpdateOutcome> => {
  try {
    const standalone = isStandaloneExecutable();
    const enabled = await shouldAutoUpdateCli({
      arguments: arguments_,
      entryPath: fileURLToPath(import.meta.url),
      environmentValue: process.env.CHOFEX_AUTO_UPDATE,
      standalone,
    });
    if (!enabled) return "continue";

    const result = await autoUpdateCli(cliVersion);
    if (result.status === "current") return "continue";
    process.stderr.write(
      `${cliPackageName} se actualizó de ${result.previousVersion} a ${result.version}.\n`,
    );
    if (standalone && process.platform === "win32") {
      process.stderr.write(
        "La actualización se aplicará cuando termine este comando.\n",
      );
      return "continue";
    }

    process.exitCode = await runUpdatedCli();
    return "command-completed";
  } catch {
    process.stderr.write(
      `No se pudo comprobar o instalar una actualización de ${cliPackageName}; se continuará con ${cliVersion}.\n`,
    );
    return "continue";
  }
};

Effect.promise(runAutomaticUpdate).pipe(
  Effect.flatMap((outcome) => {
    if (outcome === "command-completed") return Effect.void;
    return programForArguments();
  }),
  Effect.provide(NodeServices.layer),
  (program) => NodeRuntime.runMain(program, { disableErrorReporting: true }),
);
