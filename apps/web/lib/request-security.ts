import { isIP } from "node:net";

import { publicRequestOrigin } from "./public-origin";

interface Policy {
  readonly name: string;
  readonly burst: number;
  readonly perMinute: number;
  readonly globalBurst: number;
  readonly globalPerMinute: number;
}

const readPolicy: Policy = {
  name: "read",
  burst: 60,
  perMinute: 120,
  globalBurst: 300,
  globalPerMinute: 3000,
};
const writePolicy: Policy = {
  name: "write",
  burst: 30,
  perMinute: 60,
  globalBurst: 120,
  globalPerMinute: 600,
};
const executionPolicy: Policy = {
  name: "execution",
  burst: 10,
  perMinute: 30,
  globalBurst: 20,
  globalPerMinute: 120,
};
const webhookPolicy: Policy = {
  name: "webhook",
  burst: 60,
  perMinute: 600,
  globalBurst: 120,
  globalPerMinute: 1200,
};
const imagePolicy: Policy = {
  name: "image",
  burst: 30,
  perMinute: 120,
  globalBurst: 100,
  globalPerMinute: 600,
};
const pagePolicy: Policy = {
  name: "page",
  burst: 60,
  perMinute: 240,
  globalBurst: 300,
  globalPerMinute: 6000,
};

const policyFor = (request: Request): Policy | undefined => {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/health" || pathname.startsWith("/__clerk/")) return;
  if (pathname === "/api/webhooks/clerk") return webhookPolicy;
  if (pathname === "/_next/image") return imagePolicy;
  if (/^\/api\/v1\/challenges\/[^/]+\/(?:test|evaluate|query)$/.test(pathname))
    return executionPolicy;
  if (pathname.startsWith("/api/")) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method))
      return writePolicy;
    return readPolicy;
  }
  return pagePolicy;
};

export const requestClientAddress = (request: Request): string => {
  // Traefik is the only ingress. Use its appended hop, not the caller's first hop.
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded || forwarded.length > 1024) return "unknown";
  let address = forwarded.split(",").at(-1)?.trim() ?? "";
  if (address.startsWith("::ffff:") && isIP(address.slice(7)) === 4)
    address = address.slice(7);
  if (!isIP(address)) return "unknown";
  // Group IPv6 privacy addresses within a /64 to prevent trivial address rotation.
  if (isIP(address) === 6) {
    const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    const [left = "", right = ""] = normalized.split("::");
    const head = left ? left.split(":") : [];
    const tail = right ? right.split(":") : [];
    let groups = head;
    if (normalized.includes("::"))
      groups = [
        ...head,
        ...Array<string>(8 - head.length - tail.length).fill("0"),
        ...tail,
      ];
    return `${groups
      .slice(0, 4)
      .map((group) => group.padStart(4, "0"))
      .join(":")}/64`;
  }
  return address;
};

interface Bucket {
  tokens: number;
  updatedAt: number;
}

// This local guard protects each self-hosted process, including before Clerk/DB calls.
// The aggregate bucket still applies when client addresses are absent or rotate.
export const createRequestLimiter = ({
  now = () => performance.now(),
  maximumClients = 10_000,
}: {
  now?: () => number;
  maximumClients?: number;
} = {}) => {
  const clients = new Map<string, Bucket>();
  const globals = new Map<string, Bucket>();
  let sweptAt = 0;
  const available = (
    bucket: Bucket,
    burst: number,
    perMinute: number,
    time: number,
  ) => {
    bucket.tokens = Math.min(
      burst,
      bucket.tokens +
        (Math.max(0, time - bucket.updatedAt) * perMinute) / 60_000,
    );
    bucket.updatedAt = time;
  };
  return (request: Request): number | undefined => {
    const policy = policyFor(request);
    if (!policy) return;
    const time = now();
    if (time - sweptAt >= 60_000) {
      for (const [key, bucket] of clients) {
        if (time - bucket.updatedAt >= 120_000) clients.delete(key);
      }
      sweptAt = time;
    }
    let global = globals.get(policy.name);
    if (!global) {
      global = { tokens: policy.globalBurst, updatedAt: time };
      globals.set(policy.name, global);
    }
    available(global, policy.globalBurst, policy.globalPerMinute, time);
    if (global.tokens < 1)
      return Math.max(
        1,
        Math.ceil(((1 - global.tokens) * 60) / policy.globalPerMinute),
      );
    const key = `${policy.name}:${requestClientAddress(request)}`;
    let client = clients.get(key);
    if (!client) {
      // Do not evict active limits when an attacker rotates addresses.
      if (clients.size >= maximumClients) return 60;
      client = { tokens: policy.burst, updatedAt: time };
      clients.set(key, client);
    }
    available(client, policy.burst, policy.perMinute, time);
    if (client.tokens < 1)
      return Math.max(
        1,
        Math.ceil(((1 - client.tokens) * 60) / policy.perMinute),
      );
    client.tokens -= 1;
    global.tokens -= 1;
  };
};

export const mutationOriginAllowed = (request: Request): boolean => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  if (new URL(request.url).pathname === "/api/webhooks/clerk") return true;
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  const allowed = new Set([publicRequestOrigin(request)]);
  for (const configured of (process.env.CLERK_AUTHORIZED_PARTIES ?? "").split(
    ",",
  )) {
    if (configured.trim()) allowed.add(configured.trim());
  }
  return allowed.has(origin);
};

export const requestRejection = (
  request: Request,
  status: 403 | 429,
  retryAfter?: number,
): Response => {
  const suppliedId = request.headers.get("x-request-id");
  let requestId = crypto.randomUUID().toString();
  if (suppliedId && /^[A-Za-z0-9_-]{1,128}$/.test(suppliedId))
    requestId = suppliedId;
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (retryAfter !== undefined) headers["retry-after"] = String(retryAfter);
  let code = "ORIGIN_NOT_ALLOWED";
  let message = "Esta solicitud debe venir del sitio autorizado.";
  if (status === 429) {
    code = "RATE_LIMITED";
    message = "Demasiadas solicitudes. Inténtalo de nuevo en unos segundos.";
  }
  return Response.json(
    {
      version: 1,
      ok: false,
      requestId,
      error: { code, message, retryable: status === 429 },
    },
    { status, headers },
  );
};
