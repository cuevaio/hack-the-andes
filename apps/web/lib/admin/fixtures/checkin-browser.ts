// Local-only browser fixture. The API uses real handlers and a disposable database.
// From apps/web, start Next with NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='' on port 3017,
// then run: bun lib/admin/fixtures/checkin-browser.ts
// Open the printed URL. Ctrl-C removes the temporary page and database.

import { mock } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import { createCheckinFixture } from "./checkin-database";

const fixture = await createCheckinFixture();
mock.module("@chofex/db", () => ({ db: drizzle(fixture.client) }));
mock.module("@/lib/admin/auth", () => ({
  requireAdminIdentity: async () => ({ clerkUserId: "fixture-admin" }),
}));
const api = await import("@/app/api/admin/checkin/route");
await fixture.seed({
  name: "Ana",
  legalName: "Ana María Pérez",
  email: "ana@example.com",
  document: "12345678",
  confirmed: true,
});
const jose = await fixture.seed({
  name: "Pepe",
  legalName: "José García",
  email: "jose@example.com",
  document: "87654321",
  confirmed: true,
});
await fixture.seed({
  name: "Luis",
  legalName: "Luis Torres",
  email: "luis@example.com",
  document: null,
  confirmed: false,
});
await api.PATCH(
  new Request("http://localhost:3028/api/admin/checkin", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ applicationId: jose.applicationId }),
  }),
);
await fixture.client.exec(
  "update applications set picture_url='http://127.0.0.1:3028/fixture-avatar.svg'",
);
const routeDirectory = await mkdtemp(
  path.join(process.cwd(), "app/credits/checkin-qa-"),
);
await writeFile(
  path.join(routeDirectory, "page.tsx"),
  `"use client";
import { useEffect, useState } from "react";
import { CheckinDashboard } from "@/components/checkin-dashboard";
export default function Page() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const original = window.fetch;
    window.fetch = (input, init) => original(
      input === "/api/admin/checkin" ? "http://127.0.0.1:3028/api/admin/checkin" : input,
      init,
    );
    setReady(true);
    return () => { window.fetch = original; };
  }, []);
  if (!ready) return <p>Preparando datos de prueba…</p>;
  return <CheckinDashboard />;
}
`,
);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 3028,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/fixture-avatar.svg")
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" rx="12" fill="#333"/><circle cx="36" cy="27" r="12" fill="#aaa"/><path d="M13 68a23 23 0 0 1 46 0" fill="#aaa"/></svg>',
        { headers: { "content-type": "image/svg+xml" } },
      );
    if (url.pathname === "/api/admin/checkin") {
      if (request.method === "OPTIONS")
        return new Response(null, {
          headers: {
            "access-control-allow-origin": "http://localhost:3017",
            "access-control-allow-methods": "GET, POST, PATCH",
            "access-control-allow-headers": "content-type",
          },
        });
      let response: Response;
      if (request.method === "GET") response = await api.GET(request);
      else if (request.method === "POST") response = await api.POST(request);
      else if (request.method === "PATCH") response = await api.PATCH(request);
      else return new Response(null, { status: 405 });
      response.headers.set(
        "access-control-allow-origin",
        "http://localhost:3017",
      );
      return response;
    }
    return new Response(null, { status: 404 });
  },
});
async function cleanup() {
  server.stop(true);
  await rm(routeDirectory, { recursive: true, force: true });
  await fixture.client.close();
  process.exit(0);
}
process.on("SIGINT", () => void cleanup());
process.on("SIGTERM", () => void cleanup());
console.log(
  `Local check-in browser fixture: http://localhost:3017/credits/${path.basename(routeDirectory)}`,
);
