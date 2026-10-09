export const runtime = "nodejs";

export const GET = (): Response => {
  const sharedLimitsConfigured = Boolean(
    process.env.RATE_LIMIT_SERVICE_URL && process.env.RATE_LIMIT_SERVICE_TOKEN,
  );
  const ready = process.env.NODE_ENV !== "production" || sharedLimitsConfigured;
  return Response.json(
    {
      ok: ready,
      service: "hack-the-andes-web",
      revision: process.env.APP_REVISION ?? "development",
      requestLimits: sharedLimitsConfigured ? "shared" : "local",
    },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
};
