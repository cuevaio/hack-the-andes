import { expect, test } from "bun:test";
import { createSharedRequestLimiter } from "./shared-request-limiter";

const configuration = () => ({
  url: "https://limiter.example",
  token: "local-test-secret",
});
const request = () =>
  new Request("https://hacktheandes.com/api/v1/me", {
    headers: {
      "x-forwarded-for": "192.0.2.42",
      "x-request-id": "limiter-test",
    },
  });

test("shared denial preserves the CLI error envelope and hides client addresses", async () => {
  let calls = 0;
  const server = Bun.serve({
    port: 0,
    fetch: (input) => {
      expect(input.method).toBe("POST");
      expect(input.headers.get("authorization")).toBe(
        "Bearer local-test-secret",
      );
      expect(new URL(input.url).pathname).toMatch(
        /^\/consume\/read\/[0-9a-f]{64}$/,
      );
      expect(input.url).not.toContain("192.0.2.42");
      calls += 1;
      if (calls === 1) return new Response(null, { status: 204 });
      return new Response(null, {
        status: 429,
        headers: { "retry-after": "2" },
      });
    },
  });
  try {
    const limiter = createSharedRequestLimiter({
      configuration,
      fetchImpl: (input, init) =>
        fetch(new URL(new URL(String(input)).pathname, server.url), init),
    });
    expect(await limiter(request())).toBeUndefined();
    const response = await limiter(request());
    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("2");
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(await response?.json()).toMatchObject({
      version: 1,
      ok: false,
      requestId: "limiter-test",
      error: { code: "RATE_LIMITED", retryable: true },
    });
  } finally {
    server.stop(true);
  }
});

test("production rejects missing configuration while health checks stay available", async () => {
  const limiter = createSharedRequestLimiter({
    required: true,
    configuration: () => ({ url: undefined, token: undefined }),
  });
  expect((await limiter(request()))?.status).toBe(503);
  expect(
    await limiter(new Request("https://hacktheandes.com/api/health")),
  ).toBeUndefined();
  expect(
    await limiter(new Request("https://hacktheandes.com/__clerk/oauth/token")),
  ).toBeUndefined();
  const development = createSharedRequestLimiter({
    required: false,
    configuration: () => ({ url: undefined, token: undefined }),
  });
  expect(await development(request())).toBeUndefined();
});

test("invalid service replies and outages fail closed with retryable errors", async () => {
  for (const response of [
    new Response("unexpected", { status: 200 }),
    new Response(null, { status: 500 }),
    new Response(null, { status: 429, headers: { "retry-after": "100000" } }),
  ]) {
    const limiter = createSharedRequestLimiter({
      configuration,
      fetchImpl: async () => response,
    });
    const rejected = await limiter(request());
    expect(rejected?.status).toBe(503);
    expect(await rejected?.json()).toMatchObject({
      error: { code: "RATE_LIMIT_SERVICE_UNAVAILABLE", retryable: true },
    });
  }
});

test("does not forward the service secret through redirects", async () => {
  let calls = 0;
  const server = Bun.serve({
    port: 0,
    fetch: () => {
      calls += 1;
      return new Response(null, {
        status: 307,
        headers: { location: "/unexpected" },
      });
    },
  });
  try {
    const limiter = createSharedRequestLimiter({
      configuration,
      fetchImpl: (_input, init) => fetch(server.url, init),
    });
    expect((await limiter(request()))?.status).toBe(503);
    expect(calls).toBe(1);
  } finally {
    server.stop(true);
  }
});

test("stalled service requests expire instead of holding app requests open", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: () => new Promise<Response>(() => {}),
  });
  try {
    const limiter = createSharedRequestLimiter({
      configuration,
      fetchImpl: (_input, init) => fetch(server.url, init),
    });
    expect((await limiter(request()))?.status).toBe(503);
  } finally {
    server.stop(true);
  }
}, 3_000);
