export const runtime = "nodejs";

export const GET = (): Response =>
  Response.json(
    {
      ok: true,
      service: "hack-the-andes-web",
      revision: process.env.APP_REVISION ?? "development",
    },
    { headers: { "cache-control": "no-store" } },
  );
