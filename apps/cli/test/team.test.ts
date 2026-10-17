import { expect, test } from "bun:test";
import type { TeamState } from "@chofex/registration-contract";
import { invitationsText, teamText } from "../src/team-output.js";

const participantId = "00000000-0000-4000-8000-000000000001";
const teamId = "00000000-0000-4000-8000-000000000002";
const invitationId = "00000000-0000-4000-8000-000000000003";
const state: TeamState = {
  participantId,
  checkedIn: true,
  selectionOpen: true,
  team: {
    id: teamId,
    name: "Cóndores",
    track: null,
    trackChangedBy: null,
    trackChangedAt: null,
    members: [{ id: participantId, name: "Ana", checkedIn: true }],
  },
  invitations: [
    {
      id: invitationId,
      teamId: "00000000-0000-4000-8000-000000000004",
      teamName: "Pumas",
    },
  ],
  tracks: [
    { id: "environmental", teams: 0, capacity: 12 },
    { id: "security", teams: 0, capacity: 12 },
    { id: "transport", teams: 0, capacity: 12 },
  ],
};

test("team output shows roster, invitation ids, availability and safe terminal names", () => {
  const text = teamText(state);
  expect(text).toContain("Cóndores · Sin track · 1/4");
  expect(text).toContain("Ana · Check-in confirmado");
  expect(text).toContain("Clima y Territorio · 0/12");
  expect(invitationsText(state)).toContain(invitationId);
  if (!state.team) throw new Error("Team fixture required");
  expect(
    teamText({
      ...state,
      team: { ...state.team, name: "Mal\u001b[2J\nicioso" },
    }),
  ).not.toContain("\u001b");
});

async function cli(
  args: string[],
  handler: (request: Request) => Response | Promise<Response>,
) {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: handler });
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        "src/index.ts",
        "--api-url",
        server.url.toString(),
        "--token",
        "test-token",
        "--output",
        "json",
        ...args,
      ],
      {
        cwd: new URL("..", import.meta.url).pathname,
        env: { ...process.env, CHOFEX_AUTO_UPDATE: "0" },
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      },
    );
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(stdout.trim().split("\n")).toHaveLength(1);
    expect(stderr).toBe("");
    return { code, result: JSON.parse(stdout) };
  } finally {
    server.stop(true);
  }
}
const success = (data: unknown) =>
  Response.json({ version: 1, ok: true, requestId: "test-request", data });

test("CLI acceptance confirms an atomic move and sends expected source team", async () => {
  const sent: unknown[] = [];
  const result = await cli(
    ["team", "accept", "--invite", invitationId, "--yes"],
    async (request) => {
      expect(request.headers.get("authorization")).toBe("Bearer test-token");
      if (request.method === "POST") sent.push(await request.json());
      return success(state);
    },
  );
  expect(result.code).toBe(0);
  expect(result.result.data).toEqual(state);
  expect(sent).toEqual([
    { action: "accept", invitationId, expectedTeamId: teamId },
  ]);
});

test("noninteractive leave without --yes never mutates membership", async () => {
  let writes = 0;
  const result = await cli(["team", "leave"], (request) => {
    if (request.method !== "GET") writes++;
    return success(state);
  });
  expect(result.code).not.toBe(0);
  expect(result.result.error.code).toBe("CONFIRMATION_REQUIRED");
  expect(writes).toBe(0);
});

test("CLI removal excludes checked-in teammates and blocks the mutation", async () => {
  let writes = 0;
  const result = await cli(
    ["team", "remove", "--member", participantId, "--yes"],
    (request) => {
      if (request.method !== "GET") writes++;
      return success(state);
    },
  );
  expect(result.result.error.code).toBe("INVALID_CHOICE");
  expect(writes).toBe(0);
});

test("CLI track change sends the shared contract's track identifier", async () => {
  const sent: unknown[] = [];
  const result = await cli(
    ["team", "track", "--track", "security", "--yes"],
    async (request) => {
      if (request.method === "POST") sent.push(await request.json());
      return success(state);
    },
  );
  expect(result.code).toBe(0);
  expect(sent).toEqual([
    { action: "track", track: "security", expectedTeamId: teamId },
  ]);
});

test("check-in JSON mode returns one envelope without QR, polling or prompts", async () => {
  const requests: string[] = [];
  const data = {
    checkedIn: false,
    token: "a".repeat(32),
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  };
  const result = await cli(["checkin"], (request) => {
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
    return success(data);
  });
  expect(result.code).toBe(0);
  expect(result.result.data).toEqual(data);
  expect(requests).toEqual(["POST /api/v1/checkin"]);
});

test("check-in status reads existing attendance without rotating a token", async () => {
  const requests: string[] = [];
  const result = await cli(["checkin", "--status"], (request) => {
    requests.push(request.method);
    return success({ checkedIn: true });
  });
  expect(result.result.data.checkedIn).toBe(true);
  expect(requests).toEqual(["GET"]);
});

test("team rename keeps the team response shape and uses the team endpoint", async () => {
  if (!state.team) throw new Error("Missing fixture");
  const renamed = { ...state, team: { ...state.team, name: "Nuevo nombre" } };
  const writes: unknown[] = [];
  const result = await cli(
    ["team", "rename", "--name", "Nuevo nombre"],
    async (request) => {
      expect(new URL(request.url).pathname).toBe("/api/v1/team");
      if (request.method === "POST") {
        writes.push(await request.json());
        return success(renamed);
      }
      return success(state);
    },
  );
  expect(result.code).toBe(0);
  expect(result.result.data.team.name).toBe("Nuevo nombre");
  expect(writes).toEqual([
    { action: "rename", expectedTeamId: teamId, name: "Nuevo nombre" },
  ]);
});
