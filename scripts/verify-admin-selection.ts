import { readFile } from "node:fs/promises";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";

import { parseCandidateFilters } from "../apps/web/lib/admin/candidate-filters";
import {
  decideCandidate,
  listCandidates,
} from "../apps/web/lib/admin/fixtures/candidate-rankings";

const build = await Bun.build({
  entrypoints: ["apps/web/lib/admin/fixtures/selection-browser.tsx"],
  target: "browser",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
  plugins: [
    {
      name: "fixture-clerk",
      setup(builder) {
        builder.onResolve({ filter: /^@clerk\/nextjs$/ }, () => ({
          path: "clerk",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents:
            "export const UserButton = () => null; export const useUser = () => ({user: {firstName: 'Revisor'}});",
          loader: "js",
        }));
      },
    },
  ],
});
if (!build.success) throw new Error(build.logs.map(String).join("\n"));
const bundle = build.outputs[0];
if (!bundle) throw new Error("Missing fixture bundle");
const cssPath = `${process.cwd()}/packages/ui/src/styles/globals.css`;
const css = await postcss([tailwindcss()]).process(
  await readFile(cssPath, "utf8"),
  { from: cssPath },
);
let failRanking = false;
let listDelayMs = 0;

Bun.serve({
  hostname: "127.0.0.1",
  port: 4186,
  async fetch(request) {
    const url = new URL(request.url);
    if (
      url.pathname === "/fixture/ranking-error" &&
      request.method === "POST"
    ) {
      failRanking = url.searchParams.get("enabled") === "true";
      listDelayMs = Number(url.searchParams.get("delay") ?? 0);
      return Response.json({ ok: true });
    }
    if (url.pathname === "/fixture.js")
      return new Response(bundle, {
        headers: { "content-type": "text/javascript" },
      });
    if (url.pathname === "/fixture.css")
      return new Response(css.css, { headers: { "content-type": "text/css" } });
    if (url.pathname === "/api/admin/applications") {
      const filters = parseCandidateFilters(url.searchParams);
      if (listDelayMs > 0) await Bun.sleep(listDelayMs);
      if (failRanking && filters.ranking === "broken-agent") {
        return Response.json(
          { ok: false, error: { message: "Fallo de ranking de prueba" } },
          { status: 503 },
        );
      }
      return Response.json({
        ok: true,
        data: await listCandidates(filters),
      });
    }
    const decisionPath = /^\/api\/admin\/applications\/([^/]+)\/decision$/.exec(
      url.pathname,
    );
    if (decisionPath && request.method === "PATCH") {
      const applicationId = decisionPath[1];
      const body = await request.json();
      if (
        !applicationId ||
        (body.decision !== "accepted" && body.decision !== "rejected")
      ) {
        return Response.json(
          { ok: false, error: { message: "Invalid fixture decision" } },
          { status: 422 },
        );
      }
      if (body.decision === "rejected" && body.notify) {
        return Response.json(
          {
            ok: false,
            error: {
              message: "La prueba no envía correos. Desmarca la notificación.",
            },
          },
          { status: 422 },
        );
      }
      try {
        const data = await decideCandidate({
          applicationId,
          decision: body.decision,
          message: body.message,
          notify: false,
          decidedByClerkUserId: "fixture-reviewer",
        });
        return Response.json({ ok: true, data });
      } catch (error) {
        return Response.json(
          { ok: false, error: { message: String(error) } },
          { status: 409 },
        );
      }
    }
    const data = await listCandidates(parseCandidateFilters(url.searchParams));
    const serialized = JSON.stringify(data).replaceAll("<", "\\u003c");
    return new Response(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prueba de selección</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script>window.selectionFixture=${serialized};window.process={env:{NODE_ENV:'development'}};</script><script type="module" src="/fixture.js"></script></body></html>`,
      { headers: { "content-type": "text/html" } },
    );
  },
});
console.log(
  "Isolated selection fixture at http://127.0.0.1:4186/admin/participants. Clerk and badge delivery are stubbed; all application data is in PGlite.",
);
