import { randomBytes } from "node:crypto";

const url = process.env.RATE_LIMIT_SERVICE_URL;
const token = process.env.RATE_LIMIT_SERVICE_TOKEN;
if (!url || !token) throw new Error("Shared limiter configuration is required");
const clientKey = randomBytes(32).toString("hex");
const endpoint = `${url.replace(/\/$/, "")}/consume/read/${clientKey}`;
const send = (target = endpoint, authenticated = true) => {
  const headers = new Headers();
  if (authenticated) headers.set("authorization", `Bearer ${token}`);
  return fetch(target, {
    method: "POST",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(3_000),
  });
};
if ((await send(endpoint, false)).status !== 401)
  throw new Error("Unauthenticated limiter requests were accepted");
if ((await send(`${url}/consume/unrecognized/${clientKey}`)).status !== 400)
  throw new Error("Invalid policy was accepted");
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
  (await send(`${url}/consume/read/${randomBytes(32).toString("hex")}`))
    .status !== 204
)
  throw new Error("One client's limit blocked an unrelated client");
console.log(
  JSON.stringify({
    allowed,
    rejected,
    authenticated: true,
    clientIsolation: true,
  }),
);
