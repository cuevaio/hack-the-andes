import { readFile } from "node:fs/promises";
import type {
  ProjectState,
  ProjectUpdateReceipt,
} from "@chofex/registration-contract";
import { Effect, Option } from "effect";
import { Command, Flag, Prompt } from "effect/unstable/cli";
import {
  changeProject,
  getProject,
  getProjectUpdates,
  getTeam,
  publishProjectUpdate,
} from "./api-client.js";
import { root } from "./cli-root.js";
import { cliError } from "./errors.js";
import { execute } from "./output.js";
import { terminalName } from "./team-output.js";

const optional = (name: string) => Flag.string(name).pipe(Flag.optional);
const safeMarkdown = (body: string) =>
  body.replace(/[\p{C}]/gu, (character) => {
    if (character === "\n" || character === "\t") return character;
    return " ";
  });
export const projectText = ({ project }: ProjectState): string => {
  if (!project)
    return "No tienes equipo. Ejecuta andes team create o acepta una invitación.";
  const lines = [terminalName(project.teamName)];
  if (project.submission) {
    lines.push(
      "Proyecto enviado. Puedes actualizarlo con andes project submit.",
      `Aplicación: ${terminalName(project.submission.deploymentUrl)}`,
      `Presentación: ${terminalName(project.submission.presentationUrl)}`,
      safeMarkdown(project.submission.description),
    );
  } else
    lines.push(
      "Proyecto pendiente. Envía la aplicación, presentación y descripción con andes project submit.",
    );
  lines.push(`${project.updateCount} avances. Ver: andes project updates`);
  return lines.join("\n\n");
};
export const updatesText = ({ project }: ProjectState): string => {
  if (!project) return projectText({ project });
  if (!project.updates.length)
    return "Todavía no hay actualizaciones. Publica una con andes project update.";
  return project.updates
    .map(
      (update) =>
        `${terminalName(update.authorName)} · ${terminalName(update.createdAt)}\n${safeMarkdown(update.body)}`,
    )
    .join("\n\n");
};
const inputText = (
  provided: string | undefined,
  message: string,
  output: string,
  flag: string,
) =>
  Effect.gen(function* () {
    if (provided !== undefined) return provided;
    if (output === "json" || !process.stdin.isTTY || !process.stdout.isTTY)
      return yield* cliError("INPUT_REQUIRED", `Indica ${flag}.`);
    return yield* Prompt.run(Prompt.text({ message })).pipe(
      Effect.mapError(() =>
        cliError("PROMPT_CANCELLED", "Operación cancelada."),
      ),
    );
  });
const markdownInput = (
  value: Option.Option<string>,
  file: Option.Option<string>,
) =>
  Effect.gen(function* () {
    if (Option.isSome(value) && Option.isSome(file))
      return yield* cliError("INVALID_INPUT", "Usa texto o --file, no ambos.");
    if (Option.isSome(file))
      return yield* Effect.tryPromise({
        try: () => readFile(file.value, "utf8"),
        catch: () =>
          cliError("FILE_READ_FAILED", "No se pudo leer el archivo Markdown."),
      });
    return Option.getOrUndefined(value);
  });

const update = Command.make(
  "update",
  { message: optional("message"), file: optional("file") },
  ({ message, file }) =>
    Effect.gen(function* () {
      const options = yield* root;
      const client = {
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      };
      yield* execute(
        options.output,
        Effect.gen(function* () {
          const providedBody = yield* markdownInput(message, file);
          const { team } = (yield* getTeam(client)).data;
          if (!team)
            return yield* cliError("TEAM_REQUIRED", "No tienes equipo.");
          const body = yield* inputText(
            providedBody,
            `Avances, decisiones y bloqueos de ${terminalName(team.name)}`,
            options.output,
            "--message o --file",
          );
          return yield* publishProjectUpdate(client, {
            action: "update",
            expectedTeamId: team.id,
            body,
          });
        }),
        (receipt: ProjectUpdateReceipt) =>
          `Actualización publicada para ${terminalName(receipt.teamName)}.\n\n${safeMarkdown(receipt.update.body)}\n\n${receipt.updateCount} avances. Ver: andes project updates`,
      );
    }),
).pipe(
  Command.withDescription(
    "Publicar avances en Markdown para mentores y jueces; visibles en la galería al abrirse",
  ),
);

const submit = Command.make(
  "submit",
  {
    deploymentUrl: optional("deployment-url"),
    presentationUrl: optional("presentation-url"),
    description: optional("description"),
    file: optional("file"),
  },
  (flags) =>
    Effect.gen(function* () {
      const options = yield* root;
      const client = {
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      };
      yield* execute(
        options.output,
        Effect.gen(function* () {
          const descriptionInput = yield* markdownInput(
            flags.description,
            flags.file,
          );
          const { project } = (yield* getProject(client)).data;
          if (!project)
            return yield* cliError("TEAM_REQUIRED", "No tienes equipo.");
          const deploymentUrl = yield* inputText(
            Option.getOrUndefined(flags.deploymentUrl) ??
              project.submission?.deploymentUrl,
            "URL de la aplicación desplegada",
            options.output,
            "--deployment-url",
          );
          const presentationUrl = yield* inputText(
            Option.getOrUndefined(flags.presentationUrl) ??
              project.submission?.presentationUrl,
            "URL de la presentación accesible sin tu computadora",
            options.output,
            "--presentation-url",
          );
          const description = yield* inputText(
            descriptionInput ?? project.submission?.description,
            "Descripción del proyecto en Markdown",
            options.output,
            "--description o --file",
          );
          return yield* changeProject(client, {
            action: "submit",
            expectedUpdatedAt: project.submission?.updatedAt ?? null,
            expectedTeamId: project.teamId,
            deploymentUrl,
            presentationUrl,
            description,
          });
        }),
        (state) =>
          `${projectText(state)}\n\nDurante la presentación se usarán estos enlaces. No podrás conectar tu laptop.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Enviar o actualizar el proyecto; los campos omitidos conservan el valor enviado",
  ),
);

const updates = Command.make("updates", {}, () =>
  Effect.gen(function* () {
    const options = yield* root;
    yield* execute(
      options.output,
      getProjectUpdates({
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      }),
      updatesText,
    );
  }),
).pipe(Command.withDescription("Leer el historial de avances del equipo"));

export const projectCommand = Command.make("project", {}, () =>
  Effect.gen(function* () {
    const options = yield* root;
    yield* execute(
      options.output,
      getProject({
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      }),
      projectText,
    );
  }),
).pipe(
  Command.withDescription(
    "Consultar el proyecto, publicar avances y enviar la entrega",
  ),
  Command.withSubcommands([update, updates, submit]),
);
