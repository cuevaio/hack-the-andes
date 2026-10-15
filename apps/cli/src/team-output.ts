import {
  type TeamDashboard,
  type TeamState,
  trackNames,
  tracks,
} from "@chofex/registration-contract";

// Never let user-provided names inject terminal control sequences.
export const terminalName = (name: string) =>
  name.replace(/[\p{C}\p{Zl}\p{Zp}]/gu, " ");

export const teamsText = (
  dashboard: TeamDashboard,
  byTrack = false,
): string => {
  const teamLine = (team: TeamDashboard["teams"][number]) => {
    let track = "Sin track";
    if (team.track) track = trackNames[team.track];
    return `${terminalName(team.name)} · ${team.members.length}/4 · ${track}\n  ${team.members.map((m) => terminalName(m.name)).join(", ")}`;
  };
  if (!byTrack)
    return [
      `${dashboard.teams.length}/36 equipos · ${dashboard.unassigned.length} participantes sin equipo`,
      ...dashboard.teams.map(teamLine),
    ].join("\n\n");
  const lines: string[] = [];
  for (const track of tracks) {
    const teams = dashboard.teams.filter((team) => team.track === track);
    lines.push(
      `${trackNames[track]} · ${teams.length}/12 equipos`,
      ...teams.map(teamLine),
      "",
    );
  }
  lines.push(
    "Sin track",
    ...dashboard.teams.filter((team) => !team.track).map(teamLine),
  );
  return lines.join("\n");
};
export const invitationsText = (state: TeamState): string => {
  if (!state.invitations.length) return "No tienes invitaciones pendientes.";
  return [
    "Invitaciones pendientes:",
    ...state.invitations.map((i) => `  ${terminalName(i.teamName)} · ${i.id}`),
    "Aceptar: andes team accept · Rechazar: andes team decline",
  ].join("\n");
};
export const teamText = (state: TeamState): string => {
  const lines: string[] = [];
  if (state.team) {
    const team = state.team;
    let track = "Sin track";
    if (team.track) track = trackNames[team.track];
    lines.push(
      `${terminalName(team.name)} · ${track} · ${team.members.length}/4 integrantes`,
    );
    for (const member of team.members) {
      let attendance = "Sin check-in";
      if (member.checkedIn) attendance = "Check-in confirmado";
      lines.push(
        `  ${terminalName(member.name)} · ${attendance} · ${member.id}`,
      );
    }
    if (team.trackChangedBy)
      lines.push(
        `Última selección: ${terminalName(team.trackChangedBy)} · ${team.trackChangedAt}`,
      );
    lines.push("Invitar: andes team invite · Salir: andes team leave");
    if (team.members.some((m) => !m.checkedIn))
      lines.push(
        "Todos necesitan check-in para elegir track. Retirar ausentes: andes team remove",
      );
  } else {
    lines.push(
      "No tienes equipo. Crea uno con andes team create o acepta una invitación.",
    );
  }
  lines.push("", invitationsText(state), "");
  if (state.selectionOpen)
    lines.push("Selección de tracks abierta: andes team track");
  else
    lines.push(
      "La selección de tracks está cerrada. La organización anunciará su apertura.",
    );
  for (const track of state.tracks)
    lines.push(
      `  ${trackNames[track.id]} · ${track.teams}/${track.capacity} equipos`,
    );
  return lines.join("\n");
};
