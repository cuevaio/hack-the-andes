const origin = "https://hacktheandes.com";
const expectedRevision = process.env.EXPECTED_REVISION;
if (!expectedRevision || !/^[a-f0-9]{40}$/.test(expectedRevision)) {
  throw new Error("EXPECTED_REVISION must be the full deployed commit SHA");
}

let deployed = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const response = await fetch(`${origin}/api/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const health = await response.json();
      if (
        health.ok === true &&
        health.revision === expectedRevision &&
        health.requestLimits === "shared"
      ) {
        deployed = true;
        break;
      }
    }
  } catch {
    /* A replacement container may not be ready yet. */
  }
  if (attempt < 59) await Bun.sleep(5_000);
}
if (!deployed)
  throw new Error(`Production did not become healthy at ${expectedRevision}`);

const checks: Array<{ path: string; status: number; init?: RequestInit }> = [
  { path: "/", status: 200 },
  { path: "/challenges", status: 200 },
  {
    path: "/api/v1/challenges/black-box/ranking",
    status: 200,
    init: { headers: { "x-request-id": "production-security-check" } },
  },
  { path: "/api/v1/challenges/not-a-challenge/ranking", status: 404 },
  { path: "/api/v1/me", status: 401 },
  { path: "/api/admin/applications", status: 403 },
  {
    path: "/api/v1/registration",
    status: 403,
    init: {
      method: "POST",
      headers: {
        origin: "https://attacker.invalid",
        "x-forwarded-host": "attacker.invalid",
      },
    },
  },
  {
    path: "/api/webhooks/clerk",
    status: 400,
    init: { method: "POST", body: "{}" },
  },
  {
    path: "/.well-known/oauth-protected-resource",
    status: 200,
    init: {
      headers: {
        "x-forwarded-host": "attacker.invalid",
        "x-forwarded-proto": "http",
      },
    },
  },
];
for (const check of checks) {
  const response = await fetch(`${origin}${check.path}`, {
    ...check.init,
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status !== check.status)
    throw new Error(
      `${check.path}: expected ${check.status}, received ${response.status}`,
    );
  if (check.path === "/api/v1/challenges/black-box/ranking") {
    const body = await response.json();
    if (
      body.version !== 1 ||
      body.ok !== true ||
      body.requestId !== "production-security-check"
    )
      throw new Error("Ranking envelope changed");
    if (!response.headers.get("cache-control")?.includes("no-store"))
      throw new Error("Ranking response may be shared between request IDs");
  }
  if (check.path === "/.well-known/oauth-protected-resource") {
    const body = await response.json();
    if (body.resource !== origin)
      throw new Error("OAuth discovery trusted a forged host");
  }
  console.log(`${check.path}: ${response.status}`);
}
console.log(`Verified live production revision ${expectedRevision}`);

export {};
