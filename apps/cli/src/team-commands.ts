import {
  type TeamAction,
  trackNames,
  tracks,
} from "@chofex/registration-contract";
import { Effect, Option } from "effect";
import { Command, Flag, Prompt } from "effect/unstable/cli";
import { changeTeam, getTeam, listTeams } from "./api-client.js";
import { root } from "./cli-root.js";
import { cliError } from "./errors.js";
import { execute } from "./output.js";
import {
  invitationsText,
  teamsText,
  teamText,
  terminalName,
} from "./team-output.js";

const optional = (name: string) => Flag.string(name).pipe(Flag.optional);
const yes = Flag.boolean("yes").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Confirmar la operación sin preguntas"),
);
const interactive = (output: string) =>
  output !== "json" && process.stdin.isTTY && process.stdout.isTTY;

const confirm = (message: string, accepted: boolean, output: string) =>
  Effect.gen(function* () {
    if (accepted) return;
    if (!interactive(output))
      return yield* cliError(
        "CONFIRMATION_REQUIRED",
        "Vuelve a ejecutar con --yes para confirmar esta operación.",
      );
    const answer = yield* Prompt.run(
      Prompt.confirm({ message, initial: false }),
    ).pipe(
      Effect.mapError(() =>
        cliError("PROMPT_CANCELLED", "Operación cancelada."),
      ),
    );
    if (!answer)
      return yield* cliError(
        "PROMPT_CANCELLED",
        "Operación cancelada. No se cambió tu equipo.",
      );
  });

const text = (
  provided: Option.Option<string>,
  message: string,
  output: string,
  flag: string,
) =>
  Effect.gen(function* () {
    if (Option.isSome(provided)) return provided.value;
    if (!interactive(output))
      return yield* cliError("INPUT_REQUIRED", `Indica ${flag}.`);
    return yield* Prompt.run(Prompt.text({ message })).pipe(
      Effect.mapError(() =>
        cliError("PROMPT_CANCELLED", "Operación cancelada."),
      ),
    );
  });

const choose = <A extends string>(
  provided: Option.Option<A>,
  message: string,
  choices: { title: string; value: A }[],
  output: string,
  flag: string,
) =>
  Effect.gen(function* () {
    if (Option.isSome(provided)) {
      if (!choices.some((choice) => choice.value === provided.value))
        return yield* cliError(
          "INVALID_CHOICE",
          "La opción ya no está disponible. Ejecuta andes team para actualizar.",
        );
      return provided.value;
    }
    if (!choices.length)
      return yield* cliError(
        "NO_OPTIONS",
        "No hay opciones disponibles para esta operación.",
      );
    if (!interactive(output))
      return yield* cliError("INPUT_REQUIRED", `Indica ${flag}.`);
    return yield* Prompt.run(Prompt.select({ message, choices })).pipe(
      Effect.mapError(() =>
        cliError("PROMPT_CANCELLED", "Operación cancelada."),
      ),
    );
  });

const create = Command.make("create", { name: optional("name") }, ({ name }) =>
  Effect.gen(function* () {
    const options = yield* root;
    yield* execute(
      options.output,
      Effect.gen(function* () {
        const value = yield* text(
          name,
          "Nombre del equipo",
          options.output,
          "--name",
        );
        return yield* changeTeam(
          {
            apiUrl: options.apiUrl,
            token: Option.getOrUndefined(options.token),
          },
          { action: "create", name: value },
        );
      }),
      teamText,
    );
  }),
).pipe(Command.withDescription("Crear un equipo de 1–4 integrantes"));

const rename = Command.make("rename", { name: optional("name") }, ({ name }) =>
  Effect.gen(function* () {
    const options = yield* root;
    const client = {
      apiUrl: options.apiUrl,
      token: Option.getOrUndefined(options.token),
    };
    yield* execute(
      options.output,
      Effect.gen(function* () {
        const state = (yield* getTeam(client)).data;
        if (!state.team)
          return yield* cliError("TEAM_REQUIRED", "No tienes equipo.");
        const value = yield* text(
          name,
          `Nuevo nombre de ${terminalName(state.team.name)}`,
          options.output,
          "--name",
        );
        return yield* changeTeam(client, {
          action: "rename",
          expectedTeamId: state.team.id,
          name: value,
        });
      }),
      teamText,
    );
  }),
).pipe(Command.withDescription("Cambiar el nombre del equipo y del proyecto"));

const invite = Command.make(
  "invite",
  { email: optional("email") },
  ({ email }) =>
    Effect.gen(function* () {
      const options = yield* root;
      yield* execute(
        options.output,
        Effect.gen(function* () {
          const value = yield* text(
            email,
            "Correo principal de tu compañero/a",
            options.output,
            "--email",
          );
          return yield* changeTeam(
            {
              apiUrl: options.apiUrl,
              token: Option.getOrUndefined(options.token),
            },
            { action: "invite", email: value },
          );
        }),
        (state) =>
          `Invitación guardada. Aparecerá en andes team invites de esa persona.\n\n${teamText(state)}`,
      );
    }),
).pipe(
  Command.withDescription(
    "Invitar por correo principal; la aceptación ocurre en el CLI",
  ),
);

const invitationCommand = (action: "accept" | "decline") =>
  Command.make(
    action,
    { invitation: optional("invite"), yes },
    ({ invitation, yes }) =>
      Effect.gen(function* () {
        const options = yield* root;
        const client = {
          apiUrl: options.apiUrl,
          token: Option.getOrUndefined(options.token),
        };
        yield* execute(
          options.output,
          Effect.gen(function* () {
            const state = (yield* getTeam(client)).data;
            const invitationId = yield* choose(
              invitation,
              "Selecciona una invitación",
              state.invitations.map((i) => ({
                title: terminalName(i.teamName),
                value: i.id,
              })),
              options.output,
              "--invite",
            );
            const selected = state.invitations.find(
              (i) => i.id === invitationId,
            );
            let message = `¿Rechazar la invitación a “${terminalName(selected?.teamName ?? "")}”?`;
            if (action === "accept") {
              message = `¿Unirte a “${terminalName(selected?.teamName ?? "")}”?`;
              if (state.team) {
                message += ` Saldrás de “${terminalName(state.team.name)}”.`;
                if (state.team.members.length === 1)
                  message +=
                    " Tu equipo actual se disolverá y liberará su track. La organización conservará su entrega y avances archivados.";
              }
              message +=
                " Adoptarás el track del equipo de destino, si ya tiene uno.";
            }
            yield* confirm(message, yes, options.output);
            let command: TeamAction = { action: "decline", invitationId };
            if (action === "accept")
              command = {
                action,
                invitationId,
                expectedTeamId: state.team?.id ?? null,
              };
            return yield* changeTeam(client, command);
          }),
          teamText,
        );
      }),
  ).pipe(
    Command.withDescription(
      `${action === "accept" ? "Aceptar" : "Rechazar"} una invitación`,
    ),
  );

const leave = Command.make("leave", { yes }, ({ yes }) =>
  Effect.gen(function* () {
    const options = yield* root;
    const client = {
      apiUrl: options.apiUrl,
      token: Option.getOrUndefined(options.token),
    };
    yield* execute(
      options.output,
      Effect.gen(function* () {
        const state = (yield* getTeam(client)).data;
        if (!state.team)
          return yield* cliError("TEAM_REQUIRED", "No tienes equipo.");
        let message = `¿Salir de “${terminalName(state.team.name)}”?`;
        if (state.team.members.length === 1)
          message +=
            " El equipo se disolverá, sus invitaciones se cancelarán y su track quedará libre. La organización conservará su entrega y avances archivados.";
        yield* confirm(message, yes, options.output);
        return yield* changeTeam(client, {
          action: "leave",
          expectedTeamId: state.team.id,
        });
      }),
      teamText,
    );
  }),
).pipe(
  Command.withDescription(
    "Salir de tu equipo; un equipo vacío se elimina inmediatamente",
  ),
);

const remove = Command.make(
  "remove",
  { member: optional("member"), yes },
  ({ member, yes }) =>
    Effect.gen(function* () {
      const options = yield* root;
      const client = {
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      };
      yield* execute(
        options.output,
        Effect.gen(function* () {
          const state = (yield* getTeam(client)).data;
          if (!state.team)
            return yield* cliError("TEAM_REQUIRED", "No tienes equipo.");
          if (!state.checkedIn)
            return yield* cliError(
              "CHECKIN_REQUIRED",
              "Necesitas check-in para retirar a una persona ausente.",
            );
          const candidates = state.team.members.filter(
            (m) => !m.checkedIn && m.id !== state.participantId,
          );
          const participantId = yield* choose(
            member,
            "Retirar integrante sin check-in",
            candidates.map((m) => ({
              title: terminalName(m.name),
              value: m.id,
            })),
            options.output,
            "--member",
          );
          const selected = candidates.find((m) => m.id === participantId);
          yield* confirm(
            `¿Retirar a ${terminalName(selected?.name ?? "")}? No tiene check-in y podrá unirse a otro equipo o recibir otra invitación.`,
            yes,
            options.output,
          );
          return yield* changeTeam(client, {
            action: "remove",
            participantId,
            expectedTeamId: state.team.id,
          });
        }),
        teamText,
      );
    }),
).pipe(
  Command.withDescription(
    "Retirar solo a integrantes que aún no tienen check-in",
  ),
);

const track = Command.make(
  "track",
  { track: Flag.choice("track", tracks).pipe(Flag.optional), yes },
  ({ track, yes }) =>
    Effect.gen(function* () {
      const options = yield* root;
      const client = {
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      };
      yield* execute(
        options.output,
        Effect.gen(function* () {
          const state = (yield* getTeam(client)).data;
          if (!state.team)
            return yield* cliError("TEAM_REQUIRED", "No tienes equipo.");
          if (!state.selectionOpen)
            return yield* cliError(
              "TRACK_SELECTION_CLOSED",
              "La selección de tracks está cerrada. La organización anunciará su apertura.",
            );
          const selected = yield* choose(
            track,
            "Elige un track para todo el equipo",
            state.tracks.map((t) => ({
              title: `${trackNames[t.id]} · ${t.teams}/${t.capacity} equipos`,
              value: t.id,
            })),
            options.output,
            "--track",
          );
          yield* confirm(
            `¿Seleccionar ${trackNames[selected]} para todo el equipo? Si no hay cupo, se conservará tu track actual.`,
            yes,
            options.output,
          );
          return yield* changeTeam(client, {
            action: "track",
            track: selected,
            expectedTeamId: state.team.id,
          });
        }),
        teamText,
      );
    }),
).pipe(
  Command.withDescription(
    "Elegir o cambiar el track del equipo cuando la organización lo habilite",
  ),
);

const invites = Command.make("invites", {}, () =>
  Effect.gen(function* () {
    const options = yield* root;
    yield* execute(
      options.output,
      getTeam({
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      }),
      invitationsText,
    );
  }),
).pipe(Command.withDescription("Ver invitaciones pendientes"));

const list = (byTrack: boolean) =>
  Command.make(byTrack ? "tracks" : "list", {}, () =>
    Effect.gen(function* () {
      const options = yield* root;
      yield* execute(
        options.output,
        listTeams({
          apiUrl: options.apiUrl,
          token: Option.getOrUndefined(options.token),
        }),
        (data) => teamsText(data, byTrack),
      );
    }),
  ).pipe(
    Command.withDescription(
      byTrack
        ? "Ver equipos agrupados por track"
        : "Ver todos los equipos e integrantes",
    ),
  );

export const teamCommand = Command.make("team", {}, () =>
  Effect.gen(function* () {
    const options = yield* root;
    yield* execute(
      options.output,
      getTeam({
        apiUrl: options.apiUrl,
        token: Option.getOrUndefined(options.token),
      }),
      teamText,
    );
  }),
).pipe(
  Command.withDescription("Gestionar tu equipo, invitaciones y track"),
  Command.withSubcommands([
    list(false),
    list(true),
    create,
    rename,
    invite,
    invites,
    invitationCommand("accept"),
    invitationCommand("decline"),
    leave,
    remove,
    track,
  ]),
);
