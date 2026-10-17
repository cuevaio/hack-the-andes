import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectState, TeamState } from "@chofex/registration-contract";
import { projectText, updatesText } from "../src/project-commands.js";

const teamId = "00000000-0000-4000-8000-000000000002";
const state: ProjectState = {
  project: {
    teamId,
    teamName: "Cóndores",
    track: null,
    submission: null,
    updates: [],
    updateCount: 0,
  },
};
const teamState: TeamState = {
  participantId: "00000000-0000-4000-8000-000000000001",
  checkedIn: true,
  selectionOpen: true,
  invitations: [],
  tracks: [],
  team: {
    id: teamId,
    name: "Cóndores",
    track: null,
    trackChangedBy: null,
    trackChangedAt: null,
    members: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Ana",
        checkedIn: true,
      },
    ],
  },
};
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

test("project update reads Markdown and sends authenticated team-scoped update", async () => {
  const directory = await mkdtemp(join(tmpdir(), "andes-project-"));
  try {
    const file = join(directory, "update.md");
    await writeFile(file, "## Decisión\nUsamos datos abiertos.");
    const writes: unknown[] = [];
    const result = await cli(
      ["project", "update", "--file", file],
      async (request) => {
        expect(request.headers.get("authorization")).toBe("Bearer test-token");
        if (request.method === "POST") {
          writes.push(await request.json());
          return success({
            teamId,
            teamName: "Cóndores",
            updateCount: 1,
            update: {
              id: "00000000-0000-4000-8000-000000000003",
              authorName: "Ana",
              createdAt: "2026-10-17T12:00:00Z",
              body: "## Decisión\nUsamos datos abiertos.",
            },
          });
        }
        expect(new URL(request.url).pathname).toBe("/api/v1/team");
        return success(teamState);
      },
    );
    expect(result.code).toBe(0);
    expect(result.result.data.update.body).toBe(
      "## Decisión\nUsamos datos abiertos.",
    );
    expect(result.result.data.project).toBeUndefined();
    expect(writes).toEqual([
      {
        action: "update",
        expectedTeamId: teamId,
        body: "## Decisión\nUsamos datos abiertos.",
      },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("project submit preserves previously submitted fields during partial edits", async () => {
  if (!state.project) throw new Error("Missing fixture");
  const saved: ProjectState = {
    project: {
      ...state.project,
      submission: {
        deploymentUrl: "https://demo.example.com",
        presentationUrl: "https://slides.example.com",
        githubUrl: "https://github.com/example/project",
        description: "Original",
        submittedAt: "2026-10-16T12:00:00.000Z",
        updatedAt: "2026-10-16T12:00:00.000Z",
      },
    },
  };
  const writes: unknown[] = [];
  const result = await cli(
    ["project", "submit", "--description", "## Nueva descripción"],
    async (request) => {
      if (request.method === "POST") writes.push(await request.json());
      return success(saved);
    },
  );
  expect(result.code).toBe(0);
  expect(writes).toEqual([
    {
      action: "submit",
      expectedUpdatedAt: "2026-10-16T12:00:00.000Z",
      expectedTeamId: teamId,
      deploymentUrl: "https://demo.example.com",
      presentationUrl: "https://slides.example.com",
      githubUrl: "https://github.com/example/project",
      description: "## Nueva descripción",
    },
  ]);
});

test("incomplete first submission returns a single failure envelope and never writes", async () => {
  let writes = 0;
  const result = await cli(
    ["project", "submit", "--deployment-url", "https://demo.example.com"],
    (request) => {
      if (request.method !== "GET") writes++;
      return success(state);
    },
  );
  expect(result.code).not.toBe(0);
  expect(result.result.error.code).toBe("INPUT_REQUIRED");
  expect(writes).toBe(0);
});

test("ambiguous Markdown sources never send a request", async () => {
  let requests = 0;
  const result = await cli(
    ["project", "update", "--message", "Hello", "--file", "missing.md"],
    () => {
      requests++;
      return success(state);
    },
  );
  expect(result.result.error.code).toBe("INVALID_INPUT");
  expect(requests).toBe(0);
});

test("project human output preserves Markdown newlines and removes terminal escapes", () => {
  if (!state.project) throw new Error("Missing fixture");
  const unsafe: ProjectState = {
    project: {
      ...state.project,
      teamName: "Team\u001b[2J",
      updateCount: 1,
      updates: [
        {
          id: "00000000-0000-4000-8000-000000000005",
          authorName: "Ana\u001b",
          createdAt: "2026-10-16T12:00:00.000Z",
          body: "## Avance\nDemo\u001b[2J",
        },
      ],
    },
  };
  expect(projectText(unsafe)).not.toContain("\u001b");
  expect(updatesText(unsafe)).not.toContain("\u001b");
  expect(updatesText(unsafe)).toContain("## Avance\nDemo");
});

test("first submission sends all four required details and a null revision", async () => {
  const writes: unknown[] = [];
  const result = await cli(
    [
      "project",
      "submit",
      "--deployment-url",
      "https://demo.example.com",
      "--presentation-url",
      "https://slides.example.com",
      "--github-url",
      "https://github.com/example/project",
      "--description",
      "## Producto",
    ],
    async (request) => {
      if (request.method === "POST") writes.push(await request.json());
      return success(state);
    },
  );
  expect(result.code).toBe(0);
  expect(writes).toEqual([
    {
      action: "submit",
      expectedTeamId: teamId,
      expectedUpdatedAt: null,
      deploymentUrl: "https://demo.example.com",
      presentationUrl: "https://slides.example.com",
      githubUrl: "https://github.com/example/project",
      description: "## Producto",
    },
  ]);
});

test("stale submission conflict preserves the server error without retrying the write", async () => {
  let writes = 0;
  const result = await cli(
    [
      "project",
      "submit",
      "--deployment-url",
      "https://demo.example.com",
      "--presentation-url",
      "https://slides.example.com",
      "--github-url",
      "https://github.com/example/project",
      "--description",
      "## Producto",
    ],
    (request) => {
      if (request.method === "GET") return success(state);
      writes++;
      return Response.json(
        {
          version: 1,
          ok: false,
          requestId: "conflict",
          error: {
            code: "PROJECT_CHANGED",
            message:
              "Otra persona actualizó el proyecto. Vuelve a consultarlo.",
            retryable: false,
          },
        },
        { status: 409 },
      );
    },
  );
  expect(result.code).not.toBe(0);
  expect(result.result.error.code).toBe("PROJECT_CHANGED");
  expect(writes).toBe(1);
});

test("direct updates preserve long text, quotes and shell characters without returning prior history", async () => {
  const body =
    'Terminamos el flujo. "Comillas", $HOME y `código`.\nDesplegamos y corregimos el error. '.repeat(
      25,
    );
  const writes: unknown[] = [];
  const result = await cli(
    ["project", "update", "--message", body],
    async (request) => {
      if (request.method === "GET") {
        expect(new URL(request.url).pathname).toBe("/api/v1/team");
        return success(teamState);
      }
      writes.push(await request.json());
      return success({
        teamId,
        teamName: "Cóndores",
        updateCount: 25,
        update: {
          id: "00000000-0000-4000-8000-000000000003",
          authorName: "Ana",
          createdAt: "2026-10-17T12:00:00Z",
          body,
        },
      });
    },
  );
  expect(result.code).toBe(0);
  expect(writes).toEqual([{ action: "update", expectedTeamId: teamId, body }]);
  expect(result.result.data.update.body).toBe(body);
  expect(result.result.data.updateCount).toBe(25);
  expect(Object.keys(result.result.data).sort()).toEqual([
    "teamId",
    "teamName",
    "update",
    "updateCount",
  ]);
});

test("submission without GitHub returns an input error and never writes", async () => {
  let writes = 0;
  const result = await cli(
    [
      "project",
      "submit",
      "--deployment-url",
      "https://demo.example.com",
      "--presentation-url",
      "https://slides.example.com",
      "--description",
      "Proyecto",
    ],
    (request) => {
      if (request.method !== "GET") writes++;
      return success(state);
    },
  );
  expect(result.code).not.toBe(0);
  expect(result.result.error.code).toBe("INPUT_REQUIRED");
  expect(JSON.stringify(result.result)).toContain("--github-url");
  expect(writes).toBe(0);
});
