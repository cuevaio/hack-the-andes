// Run from apps/web with: bun lib/judging/fixtures/browser.ts
// Start Next separately on port 3019 with an empty NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.
// This fixture uses a disposable database and removes its temporary route on exit.
import { mock } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

mock.module("server-only", () => ({}));
const database = new PGlite();
const migrations = new URL(
  "../../../../../packages/db/drizzle/",
  import.meta.url,
);
for (const file of (await readdir(migrations))
  .filter((file) => file.endsWith(".sql"))
  .sort())
  await database.exec(await readFile(new URL(file, migrations), "utf8"));
mock.module("@chofex/db", () => ({ db: drizzle(database) }));
mock.module("@/lib/judging/auth", () => ({
  requireJudgingIdentity: async (role: string) => ({
    clerkUserId: role === "judge" ? "fixture-judge" : "fixture-admin",
  }),
}));
const admin = await import("@/app/api/admin/judging/route");
const judge = await import("@/app/api/judging/route");
await database.exec(`insert into judging_judges(clerk_user_id,name) values('fixture-judge','Ana Jurado'),('fixture-other','Bruno Jurado');
 insert into teams(name) values('Andes Conecta'),('Ruta Segura');
 insert into project_submissions(team_id,deployment_url,presentation_url,description) select id,'https://example.com/demo','https://example.com/slides','## Una solución para nuestra ciudad\n\nProbamos el prototipo con **12 usuarios** y entrevistamos a 20 personas. Incluye una API propia y datos geográficos.' from teams;`);
const command = (body: object) =>
  new Request("http://localhost:3030/api/admin/judging", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
await admin.PATCH(command({ action: "initialize", expectedRevision: 0 }));
const data = (
  await database.query<{ id: string }>(
    "select id from judging_presentations order by position",
  )
).rows[0];
if (!data) throw new Error("Missing presentation");
await admin.PATCH(
  command({ action: "present", presentationId: data.id, expectedRevision: 1 }),
);
const directory = await mkdtemp(
  path.join(process.cwd(), "app/credits/judging-qa-"),
);
await writeFile(
  path.join(directory, "page.tsx"),
  `"use client";
import { useEffect, useState } from "react";
import { Schema } from "effect";
import { JudgePanel } from "@/components/judging/judge-panel";
import { JudgingControl } from "@/components/judging/judging-control";
import { JudgeBoardSchema, AdminBoardSchema } from "@/lib/judging/contract";
export default function Page() {
 const [data,setData] = useState<unknown>(null);
 const [admin,setAdmin] = useState(false);
 useEffect(() => {
  const isAdmin = new URLSearchParams(window.location.search).has("admin"); setAdmin(isAdmin);
  const original = window.fetch;
  window.fetch = Object.assign((input: RequestInfo | URL,init?: RequestInit) => {
   let target = input;
   if (typeof input === "string" && input.startsWith("/api/")) target = new URL(input,"http://localhost:3030");
   return original(target,init);
  }, original);
  fetch(isAdmin ? "/api/admin/judging" : "/api/judging").then(response => response.json()).then(body => setData(body.data));
  return () => { window.fetch = original; };
 },[]);
 if (!data) return <p>Preparando evaluación…</p>;
 if (admin) return <JudgingControl adminId="fixture-admin" initialData={Schema.decodeUnknownSync(AdminBoardSchema)(data)} />;
 return <JudgePanel judgeId="fixture-judge" initialData={Schema.decodeUnknownSync(JudgeBoardSchema)(data)} />;
}
`,
);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 3030,
  async fetch(request) {
    const headers = {
      "access-control-allow-origin": "http://localhost:3019",
      "access-control-allow-methods": "GET,PATCH,POST",
      "access-control-allow-headers": "content-type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers });
    const url = new URL(request.url);
    let response: Response;
    if (url.pathname === "/api/admin/judging") {
      if (request.method === "PATCH") response = await admin.PATCH(request);
      else response = await admin.GET(request);
    } else if (url.pathname === "/api/judging") {
      if (request.method === "PATCH") response = await judge.PATCH(request);
      else response = await judge.GET(request);
    } else return new Response(null, { status: 404, headers });
    for (const [key, value] of Object.entries(headers))
      response.headers.set(key, value);
    return response;
  },
});
async function cleanup() {
  server.stop(true);
  await rm(directory, { recursive: true, force: true });
  await database.close();
  process.exit(0);
}
process.on("SIGINT", () => void cleanup());
process.on("SIGTERM", () => void cleanup());
console.log(
  `Judging fixture: http://localhost:3019/credits/${path.basename(directory)}\nAdmin: add ?admin=1`,
);
