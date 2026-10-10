import { mock } from "bun:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mountainLodgeExample } from "@chofex/challenges-contract/mountain-lodge";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

const client = new PGlite();
const adminRole = true;
let challengeNow = new Date("2026-10-12T23:59:59Z");
mock.module("server-only", () => ({}));
mock.module("@chofex/db", () => ({ db: drizzle(client) }));
mock.module("../clock", () => ({
  currentChallengeTime: () => challengeNow,
  challengesForceOpen: () => false,
}));
mock.module("../../funnel-reminders/enqueue", () => ({
  enqueueChallengeFinishReminderBestEffort: async () => undefined,
}));
mock.module("../../posthog-server", () => ({
  captureProductEvent: async () => undefined,
}));
process.env.CLERK_CLI_OAUTH_CLIENT_ID = "test-cli";
process.env.CLERK_AUTHORIZED_PARTIES = "https://hacktheandes.com";
mock.module("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    authenticateRequest: async (
      request: Request,
      options: { acceptsToken: string },
    ) => {
      const value = request.headers
        .get("authorization")
        ?.replace("Bearer ", "");
      const oauth = value?.endsWith("-oauth");
      const id = value?.replace(/-(oauth|session)$/, "");
      return {
        isAuthenticated:
          Boolean(id) &&
          options.acceptsToken === (oauth ? "oauth_token" : "session_token"),
        toAuth: () => ({
          tokenType: oauth ? "oauth_token" : "session_token",
          userId: id,
          clientId: "test-cli",
        }),
      };
    },
    users: {
      getUser: async (id: string) => ({
        publicMetadata: {
          role: id === "admin" && adminRole ? "admin" : "participant",
        },
        privateMetadata: {},
      }),
    },
  }),
}));
const engine = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: async (request) => {
    const body = await request.json();
    assert.equal(body.challengeVersion, "mountain-lodge-v1");
    if (new URL(request.url).pathname === "/api/v1/query")
      return Response.json({ version: 1, output: 420 });
    return Response.json({
      version: 1,
      score: {
        accuracy: 0.75,
        exactCount: 750,
        sampleSize: 1000,
        meanError: 10,
        queriesUsed: body.queriesUsed,
        runtimeMs: 2,
      },
    });
  },
});
process.env.CHALLENGE_ENGINE_URL = engine.url.origin;
process.env.CHALLENGE_ENGINE_API_SECRET = "test-secret";
const { GET: catalog } = await import("../../../app/api/v1/challenges/route");
const { GET: show } = await import(
  "../../../app/api/v1/challenges/[slug]/route"
);
const { POST: query } = await import(
  "../../../app/api/v1/challenges/[slug]/query/route"
);
const { POST: test } = await import(
  "../../../app/api/v1/challenges/[slug]/test/route"
);
const { POST: evaluate } = await import(
  "../../../app/api/v1/challenges/[slug]/evaluate/route"
);
const migrations = new URL(
  "../../../../../packages/db/drizzle/",
  import.meta.url,
);
for (const migration of (await readdir(migrations))
  .filter((file) => file.endsWith(".sql"))
  .sort()) {
  await client.exec(
    (await Bun.file(new URL(migration, migrations)).text()).replaceAll(
      "--> statement-breakpoint",
      "",
    ),
  );
}
const api = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: async (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/challenges") return catalog(request);
    const context = { params: Promise.resolve({ slug: "mountain-lodge" }) };
    if (path.endsWith("/query")) return query(request, context);
    if (path.endsWith("/test")) return test(request, context);
    if (path.endsWith("/evaluate")) return evaluate(request, context);
    return show(request, context);
  },
});
const directory = await mkdtemp(join(tmpdir(), "mountain-lodge-early-cli-"));
const cli = fileURLToPath(
  new URL("../../../../../apps/cli/src/index.ts", import.meta.url),
);
const runCli = async (token: string, ...args: string[]) => {
  const child = Bun.spawn(
    [
      process.execPath,
      cli,
      "--output",
      "json",
      "--api-url",
      api.url.origin,
      "challenge",
      ...args,
    ],
    {
      cwd: directory,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, CHOFEX_TOKEN: token, CHOFEX_AUTO_UPDATE: "0" },
    },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  assert.equal(stderr, "");
  return { exitCode, body: JSON.parse(stdout) };
};
const request = async (
  action: string,
  input: unknown,
  token = "admin-oauth",
) => {
  const response = await fetch(
    new URL(`/api/v1/challenges/mountain-lodge/${action}`, api.url),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  return { status: response.status, body: await response.json() };
};
try {
  const scheduled = await request(
    "query",
    mountainLodgeExample,
    "ordinary-oauth",
  );
  assert.equal(scheduled.status, 403);
  assert.equal(scheduled.body.error.code, "CHALLENGE_NOT_OPEN");
  challengeNow = new Date("2026-10-13T05:00:00Z");
  const initialized = await runCli(
    "ordinary-oauth",
    "init",
    "--challenge",
    "mountain-lodge",
  );
  assert.equal(initialized.exitCode, 0);
  assert.equal(
    await Bun.file(join(directory, "mountain-lodge/stay.js")).exists(),
    true,
  );
  const inputPath = join(directory, "mountain-lodge/input.json");
  const queried = await runCli(
    "ordinary-oauth",
    "query",
    "--challenge",
    "mountain-lodge",
    "--input",
    inputPath,
  );
  assert.equal(queried.exitCode, 0);
  assert.equal(queried.body.data.observation.output, 420);
  assert.equal(queried.body.data.queriesUsed, 1);
  const duplicate = await request(
    "query",
    mountainLodgeExample,
    "ordinary-oauth",
  );
  assert.equal(duplicate.status, 409);
  const source = join(directory, "mountain-lodge/stay.js");
  await Bun.write(source, "function quoteStay(input) { return 420; }");
  const tested = await runCli(
    "ordinary-oauth",
    "test",
    "--challenge",
    "mountain-lodge",
    "--source",
    source,
  );
  assert.equal(tested.exitCode, 0);
  assert.equal(tested.body.data.matchedObservations, 1);
  const evaluated = await runCli(
    "ordinary-oauth",
    "evaluate",
    "--challenge",
    "mountain-lodge",
    "--source",
    source,
  );
  assert.equal(evaluated.exitCode, 0);
  assert.equal(evaluated.body.data.exactCount, 750);
  const shown = await runCli(
    "ordinary-oauth",
    "show",
    "--challenge",
    "mountain-lodge",
  );
  assert.equal(shown.body.data.progress.queriesUsed, 1);
  assert.equal(shown.body.data.progress.evaluationsUsed, 1);
  const notebook = await runCli(
    "ordinary-oauth",
    "notebook",
    "--challenge",
    "mountain-lodge",
  );
  assert.equal(notebook.body.data.observations.length, 1);
  console.log("mountain lodge flow passed");
} finally {
  api.stop(true);
  engine.stop(true);
  await client.close();
  await rm(directory, { recursive: true, force: true });
}
