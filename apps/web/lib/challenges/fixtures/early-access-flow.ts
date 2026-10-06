import { mock } from "bun:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { powerGridExample } from "@chofex/challenges-contract/power-grid";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

const client = new PGlite();
let adminRole = true;
let challengeNow = new Date("2026-10-05T17:00:00Z");
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
    assert.equal(body.challengeVersion, "power-grid-v1");
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
    const context = { params: Promise.resolve({ slug: "power-grid" }) };
    if (path.endsWith("/query")) return query(request, context);
    if (path.endsWith("/test")) return test(request, context);
    if (path.endsWith("/evaluate")) return evaluate(request, context);
    return show(request, context);
  },
});
const directory = await mkdtemp(join(tmpdir(), "power-grid-early-cli-"));
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
    new URL(`/api/v1/challenges/power-grid/${action}`, api.url),
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
  const publicCatalog = await (
    await fetch(new URL("/api/v1/challenges", api.url))
  ).json();
  assert.equal(
    publicCatalog.data.challenges.find(
      (c: { slug: string }) => c.slug === "power-grid",
    ).open,
    false,
  );
  for (const token of ["ordinary-oauth", "ordinary-session"]) {
    assert.equal((await request("query", powerGridExample, token)).status, 403);
    assert.equal(
      (
        await request(
          "test",
          {
            kind: "javascript_source",
            source: "function calculateBill() { return 420; }",
          },
          token,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "evaluate",
          {
            kind: "javascript_source",
            source: "function calculateBill() { return 420; }",
          },
          token,
        )
      ).status,
      403,
    );
  }
  assert.deepEqual(
    (await client.query("select * from challenge_attempts")).rows,
    [],
  );
  const adminCatalog = await runCli("admin-oauth", "list");
  assert.equal(adminCatalog.exitCode, 0);
  assert.equal(
    adminCatalog.body.data.challenges.find(
      (c: { slug: string }) => c.slug === "power-grid",
    ).open,
    true,
  );
  const deniedInit = await runCli(
    "ordinary-oauth",
    "init",
    "--challenge",
    "power-grid",
  );
  assert.equal(deniedInit.exitCode, 2);
  assert.equal(
    await Bun.file(join(directory, "power-grid/bill.js")).exists(),
    false,
  );
  assert.equal(
    (await runCli("admin-oauth", "init", "--challenge", "power-grid")).exitCode,
    0,
  );
  const input = join(directory, "power-grid/input.json");
  const queried = await runCli(
    "admin-oauth",
    "query",
    "--challenge",
    "power-grid",
    "--input",
    input,
  );
  assert.equal(queried.exitCode, 0);
  assert.equal(queried.body.data.queriesUsed, 1);
  assert.equal(queried.body.data.observation.output, 420);
  assert.equal(
    (await request("query", powerGridExample, "admin-session")).status,
    409,
  );
  const source = join(directory, "power-grid/bill.js");
  await Bun.write(source, "function calculateBill() { return 420; }");
  const tested = await runCli(
    "admin-oauth",
    "test",
    "--challenge",
    "power-grid",
    "--source",
    source,
  );
  assert.equal(tested.exitCode, 0);
  assert.equal(tested.body.data.accuracy, 1);
  const evaluated = await runCli(
    "admin-oauth",
    "evaluate",
    "--challenge",
    "power-grid",
    "--source",
    source,
  );
  assert.equal(evaluated.exitCode, 0);
  assert.equal(evaluated.body.data.accuracy, 0.75);
  for (let index = 0; index < 24; index++)
    assert.equal(
      (
        await request("query", {
          ...powerGridExample,
          consumptionKwh: 101 + index,
        })
      ).status,
      200,
    );
  assert.equal(
    (await request("query", { ...powerGridExample, consumptionKwh: 500 }))
      .status,
    429,
  );
  const solution = {
    kind: "javascript_source",
    source: "function calculateBill() { return 420; }",
  };
  assert.equal((await request("evaluate", solution)).status, 200);
  assert.equal((await request("evaluate", solution)).status, 200);
  assert.equal((await request("evaluate", solution)).status, 429);
  const viewed = await runCli(
    "admin-oauth",
    "show",
    "--challenge",
    "power-grid",
  );
  assert.equal(viewed.body.data.progress.queriesUsed, 25);
  assert.equal(viewed.body.data.progress.evaluationsUsed, 3);
  assert.equal(viewed.body.data.observations.length, 25);
  assert.equal(viewed.body.data.challenge.open, true);
  adminRole = false;
  assert.equal(
    (await request("query", { ...powerGridExample, consumptionKwh: 501 }))
      .status,
    403,
  );
  assert.equal((await request("evaluate", solution)).status, 403);
  const revoked = await runCli(
    "admin-oauth",
    "show",
    "--challenge",
    "power-grid",
  );
  assert.equal(revoked.body.data.challenge.open, false);
  challengeNow = new Date("2026-10-06T00:33:04Z");
  const launchedCatalog = await (
    await fetch(new URL("/api/v1/challenges", api.url))
  ).json();
  assert.equal(
    launchedCatalog.data.challenges.find(
      (entry: { slug: string }) => entry.slug === "power-grid",
    ).open,
    true,
  );
  for (const token of ["ordinary-oauth", "ordinary-session"]) {
    assert.equal(
      (await runCli(token, "init", "--challenge", "power-grid")).exitCode,
      0,
    );
    assert.equal(
      (
        await request(
          "query",
          {
            ...powerGridExample,
            consumptionKwh: token.endsWith("-session") ? 101 : 100,
          },
          token,
        )
      ).status,
      200,
    );
    assert.equal((await request("test", solution, token)).status, 200);
  }
  assert.equal(
    (await request("evaluate", solution, "ordinary-oauth")).status,
    200,
  );
  const ordinary = await runCli(
    "ordinary-session",
    "show",
    "--challenge",
    "power-grid",
  );
  assert.equal(ordinary.body.data.progress.queriesUsed, 2);
  assert.equal(ordinary.body.data.progress.evaluationsUsed, 1);
  const preserved = await runCli(
    "admin-oauth",
    "show",
    "--challenge",
    "power-grid",
  );
  assert.equal(preserved.body.data.progress.queriesUsed, 25);
  assert.equal(preserved.body.data.progress.evaluationsUsed, 3);
  console.log("early access flow passed");
} finally {
  api.stop(true);
  engine.stop(true);
  await client.close();
  await rm(directory, { recursive: true, force: true });
}
