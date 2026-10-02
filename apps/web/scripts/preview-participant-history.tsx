import { mock } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import tailwind from "@tailwindcss/postcss";
import { drizzle } from "drizzle-orm/pglite";
import postcss from "postcss";
import { renderToStaticMarkup } from "react-dom/server";

import { ParticipantHistory } from "@/components/participant-history";
import { ParticipantInsights } from "@/components/participant-insights";
import { parseCandidateFilters } from "@/lib/admin/candidate-filters";
import { parseHistoryQuery } from "@/lib/admin/history-query";
import { getAdminInsights } from "@/lib/admin/insights";
import { getParticipantHistory } from "@/lib/admin/participant-history";
import { currentChallengeVersionFor } from "@/lib/challenges/engine";

const client = new PGlite();
const database = drizzle(client);
mock.module("server-only", () => ({}));
mock.module("@chofex/db", () => ({ db: database }));
mock.module("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: {
      getUser: async () => ({
        createdAt: Date.parse("2026-09-01"),
        emailAddresses: [],
      }),
    },
  }),
}));
const { listCandidates } = await import("@/lib/admin/candidates");
const migrations = new URL("../../../packages/db/drizzle/", import.meta.url);
for (const file of (await readdir(migrations))
  .filter((name) => name.endsWith(".sql"))
  .sort()) {
  await client.exec(await readFile(new URL(file, migrations), "utf8"));
}
const id = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const september = (day: number) =>
  `2026-09-${String(day).padStart(2, "0")}T16:00:00Z`;
for (let index = 0; index < 30; index++) {
  let country: string | null = "PE";
  if (index % 3 === 0) country = "CO";
  if (index % 7 === 0) country = null;
  let legalName: string | null = "Fixture participant";
  if (index === 5) legalName = null;
  await client.query(
    "insert into participants (id,clerk_user_id,name,legal_name,country_code,created_at) values ($1,$2,$3,$4,$5,$6)",
    [
      id(index + 1),
      `history-fixture-${index}`,
      `Persona ${index + 1}`,
      legalName,
      country,
      september(1 + Math.floor(index / 2)),
    ],
  );
  if (index >= 28) continue;
  let status = "submitted";
  if (index < 10) status = "accepted";
  if (index >= 10 && index < 12) status = "rejected";
  if (index === 12) status = "withdrawn";
  if (index >= 24) status = "draft";
  let mode: string | null = "in_person";
  if (index === 8) mode = "remote";
  if (index === 9) mode = null;
  let submitted: string | null = september(4 + Math.floor(index / 2));
  if (status === "draft") submitted = null;
  let decided: string | null = null;
  if (index < 11) decided = september(23);
  await client.query(
    "insert into applications (id,participant_id,status,participation_mode,picture_url,created_at,submitted_at,decided_at) values ($1,$1,$2,$3,$4,$5,$6,$7)",
    [
      id(index + 1),
      status,
      mode,
      "https://example.com/photo.png",
      september(2 + Math.floor(index / 2)),
      submitted,
      decided,
    ],
  );
  if (index < 22) {
    const slug = index % 2 === 0 ? "black-box" : "broken-agent";
    await client.query(
      "insert into challenge_attempts (id,participant_id,challenge_slug,challenge_version,share_code,queries_limit,evaluations_limit,created_at) values ($1,$1,$2,$3,$4,100,10,$5)",
      [
        id(index + 1),
        slug,
        currentChallengeVersionFor(slug),
        `h${String(index).padStart(7, "0")}`,
        september(8 + Math.floor(index / 2)),
      ],
    );
    if (index < 20) {
      await client.query(
        "insert into challenge_evaluations (id,attempt_id,solution_kind,solution,accuracy,exact_count,sample_size,mean_error,queries_used,runtime_ms,created_at) values ($1,$1,'javascript','{}',0.5,5,10,0.5,0,10,$2)",
        [id(index + 1), september(10 + Math.floor(index / 2))],
      );
      await client.query(
        "update challenge_attempts set best_evaluation_id=$1 where id=$1",
        [id(index + 1)],
      );
    }
  }
  if (index < 6) {
    let first: string | null = september(25 + index);
    if (index >= 3) first = null;
    await client.query(
      "insert into acceptance_details (application_id,date_of_birth,national_id_number,shirt_size,emergency_contact_name,emergency_contact_phone,completed_at,first_completed_at) values ($1,'1996-01-01','fixture','m','Fixture','123456',$2,$3)",
      [id(index + 1), september(25 + index), first],
    );
  }
}
await client.query(
  "insert into applications (id,participant_id,status,participation_mode,created_at) values ($1,$2,'draft','in_person','2026-09-28T16:00:00Z')",
  [id(101), id(11)],
);

const cssPath = new URL(
  "../../../packages/ui/src/styles/globals.css",
  import.meta.url,
).pathname;
const styles = await postcss([
  tailwind({ base: new URL("../", import.meta.url).pathname }),
]).process(await readFile(cssPath, "utf8"), { from: cssPath });
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 4321,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/admin/applications") {
      return Response.json({
        ok: true,
        data: await listCandidates(parseCandidateFilters(url.searchParams)),
      });
    }
    if (
      url.pathname.startsWith("/api/admin/participants/") &&
      url.pathname.endsWith("/country") &&
      request.method === "PATCH"
    ) {
      const participantId = url.pathname.split("/").at(-2);
      const { countryCode } = await request.json();
      await client.query(
        "update participants set country_code=$1 where id=$2",
        [countryCode, participantId],
      );
      return Response.json({ ok: true, data: { participantId, countryCode } });
    }
    if (url.pathname === "/participant-dashboard.js") {
      const build = await Bun.build({
        entrypoints: [
          new URL("./participant-dashboard-preview.tsx", import.meta.url)
            .pathname,
        ],
        target: "browser",
        define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
        plugins: [
          {
            name: "fixture-clerk",
            setup(builder) {
              builder.onResolve({ filter: /^@clerk\/nextjs$/ }, () => ({
                path: "clerk",
                namespace: "fixture",
              }));
              builder.onResolve({ filter: /^next\/image$/ }, () => ({
                path: "image",
                namespace: "fixture",
              }));
              builder.onLoad(
                { filter: /^clerk$/, namespace: "fixture" },
                () => ({
                  contents:
                    'export const useUser = () => ({ user: { firstName: "Reviewer" } }); export const UserButton = () => null;',
                  loader: "js",
                }),
              );
              builder.onLoad(
                { filter: /^image$/, namespace: "fixture" },
                () => ({
                  contents:
                    'import { createElement } from "react"; export default function Image({ fill, unoptimized, priority, loader, quality, ...props }) { return createElement("img", props); }',
                  loader: "js",
                }),
              );
            },
          },
        ],
      });
      if (!build.success) throw new Error(build.logs.join("\n"));
      return new Response(build.outputs[0], {
        headers: { "content-type": "application/javascript" },
      });
    }
    if (url.pathname === "/styles.css")
      return new Response(styles.css, {
        headers: { "content-type": "text/css" },
      });
    const query = parseHistoryQuery(
      Object.fromEntries(url.searchParams),
      new Date("2026-10-01T20:00:00Z"),
    );
    const data = await getParticipantHistory(query, database);
    if (url.pathname === "/report.json") return Response.json(data);
    let markup = renderToStaticMarkup(
      <ParticipantHistory data={data} query={query} />,
    );
    if (url.pathname === "/admin/insights") {
      const filters = parseCandidateFilters(url.searchParams);
      markup = renderToStaticMarkup(
        <ParticipantInsights
          filters={filters}
          data={await getAdminInsights(filters, database)}
        />,
      );
    }
    if (url.pathname === "/admin/participants") {
      markup =
        '<div id="root"></div><script type="module" src="/participant-dashboard.js"></script>';
    }
    return new Response(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Historical insights fixture</title><link rel="stylesheet" href="/styles.css"></head><body>${markup}</body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  },
});
console.log(`Historical insights fixture: ${server.url}admin/insights/history`);
