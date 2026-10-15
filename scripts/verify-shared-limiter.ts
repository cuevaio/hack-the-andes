import { randomBytes } from "node:crypto";
import { requestPolicies } from "@chofex/request-limits";

type LimiterFetch = (target: string, init: RequestInit) => Promise<Response>;

export async function verifySharedLimiter(
  { url, token }: { url: string; token: string },
  fetchImpl: LimiterFetch = fetch,
) {
  const origin = url.replace(/\/$/, "");
  const clientKey = randomBytes(32).toString("hex");
  const endpoint = `${origin}/consume/read/${clientKey}`;
  const send = async (target = endpoint, authenticated = true) => {
    const headers = new Headers();
    if (authenticated) headers.set("authorization", `Bearer ${token}`);
    const response = await fetchImpl(target, {
      method: "POST",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(3_000),
    });
    await response.body?.cancel();
    return response;
  };
  if ((await send(endpoint, false)).status !== 401)
    throw new Error("Unauthenticated limiter requests were accepted");
  if (
    (await send(`${origin}/consume/unrecognized/${clientKey}`)).status !== 400
  )
    throw new Error("Invalid policy was accepted");

  // Probe every policy with its own identity, preserving the fresh read burst
  // below. Old Workers must fail verification before the new web app goes live.
  const policies: string[] = [];
  for (const policy of requestPolicies) {
    const probeKey = randomBytes(32).toString("hex");
    const response = await send(`${origin}/consume/${policy.name}/${probeKey}`);
    if (response.status !== 204) {
      throw new Error(
        `Limiter policy ${policy.name} returned ${response.status}; deploy a compatible Worker before the web app`,
      );
    }
    policies.push(policy.name);
  }

  let sent = 0;
  let allowed = 0;
  let rejected = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (sent < 80) {
        sent += 1;
        const response = await send();
        if (response.status === 204) {
          allowed += 1;
          continue;
        }
        if (
          response.status === 429 &&
          Number(response.headers.get("retry-after")) > 0
        ) {
          rejected += 1;
          continue;
        }
        throw new Error(`Unexpected limiter status ${response.status}`);
      }
    }),
  );
  if (allowed < 60 || rejected === 0)
    throw new Error("Shared burst limit was not enforced");
  if (
    (await send(`${origin}/consume/read/${randomBytes(32).toString("hex")}`))
      .status !== 204
  )
    throw new Error("One client's limit blocked an unrelated client");
  return {
    allowed,
    rejected,
    authenticated: true,
    clientIsolation: true,
    policies,
  };
}

if (import.meta.main) {
  const url = process.env.RATE_LIMIT_SERVICE_URL;
  const token = process.env.RATE_LIMIT_SERVICE_TOKEN;
  if (!url || !token)
    throw new Error("Shared limiter configuration is required");
  console.log(JSON.stringify(await verifySharedLimiter({ url, token })));
}
