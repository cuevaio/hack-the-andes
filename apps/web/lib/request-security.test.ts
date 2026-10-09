import { expect, test } from "bun:test";

import {
  createRequestLimiter,
  mutationOriginAllowed,
  requestClientAddress,
  requestRejection,
} from "./request-security";

const requestFor = (
  path = "/api/v1/challenges/black-box/ranking",
  address = "192.0.2.1",
  method = "GET",
) =>
  new Request(`https://hacktheandes.com${path}`, {
    method,
    headers: { "x-forwarded-for": address },
  });

test("enforces burst, refill, shared paths and separate write budgets", () => {
  let clock = 0;
  const limit = createRequestLimiter({ now: () => clock });
  for (let count = 0; count < 60; count += 1)
    expect(limit(requestFor())).toBeUndefined();
  expect(limit(requestFor("/api/v1/me"))).toBe(1);
  expect(
    limit(requestFor("/api/v1/registration", "192.0.2.1", "PATCH")),
  ).toBeUndefined();
  expect(limit(requestFor(undefined, "192.0.2.2"))).toBeUndefined();
  clock = 500;
  expect(limit(requestFor())).toBeUndefined();
  expect(limit(requestFor())).toBe(1);
});

test("applies stricter shared execution budgets across challenges", () => {
  const limit = createRequestLimiter({ now: () => 0 });
  for (let count = 0; count < 10; count += 1)
    expect(
      limit(requestFor("/api/v1/challenges/black-box/test", undefined, "POST")),
    ).toBeUndefined();
  expect(
    limit(requestFor("/api/v1/challenges/power-grid/query", undefined, "POST")),
  ).toBe(2);
  expect(
    limit(
      requestFor("/api/v1/challenges/broken-agent/evaluate", undefined, "POST"),
    ),
  ).toBe(2);
});

test("aggregate limits survive arbitrary address rotation while health remains available", () => {
  const limit = createRequestLimiter({ now: () => 0 });
  for (let count = 0; count < 300; count += 1)
    expect(
      limit(
        requestFor(
          undefined,
          `192.0.${Math.floor(count / 255)}.${count % 255}`,
        ),
      ),
    ).toBeUndefined();
  expect(limit(requestFor(undefined, "198.51.100.1"))).toBe(1);
  for (let count = 0; count < 1000; count += 1)
    expect(limit(requestFor("/api/health"))).toBeUndefined();
});

test("caps tracked addresses without evicting active limits, then reclaims idle entries", () => {
  let clock = 0;
  const limit = createRequestLimiter({ now: () => clock, maximumClients: 2 });
  expect(limit(requestFor(undefined, "192.0.2.1"))).toBeUndefined();
  expect(limit(requestFor(undefined, "192.0.2.2"))).toBeUndefined();
  expect(limit(requestFor(undefined, "192.0.2.3"))).toBe(60);
  expect(limit(requestFor(undefined, "192.0.2.1"))).toBeUndefined();
  clock = 120_000;
  expect(limit(requestFor(undefined, "192.0.2.3"))).toBeUndefined();
});

test("uses the appended ingress hop and normalizes IPv4 and IPv6 identities", () => {
  expect(
    requestClientAddress(requestFor(undefined, "198.51.100.9, 192.0.2.1")),
  ).toBe("192.0.2.1");
  expect(requestClientAddress(requestFor(undefined, "::ffff:192.0.2.1"))).toBe(
    "192.0.2.1",
  );
  expect(requestClientAddress(requestFor(undefined, "2001:db8::1"))).toBe(
    "2001:0db8:0000:0000/64",
  );
  expect(
    requestClientAddress(requestFor(undefined, "2001:0db8:0000:0000:ffff::2")),
  ).toBe("2001:0db8:0000:0000/64");
  expect(requestClientAddress(requestFor(undefined, "not-an-ip"))).toBe(
    "unknown",
  );
  expect(requestClientAddress(requestFor(undefined, "x".repeat(2000)))).toBe(
    "unknown",
  );
});

test("protects browser writes while preserving CLI requests and signed webhook delivery", () => {
  const crossSite = new Request(
    "https://hacktheandes.com/api/admin/applications/1/decision",
    {
      method: "PATCH",
      headers: {
        origin: "https://attacker.example",
        "x-forwarded-host": "attacker.example",
      },
    },
  );
  expect(mutationOriginAllowed(crossSite)).toBe(false);
  expect(
    mutationOriginAllowed(
      new Request("https://hacktheandes.com/api/v1/badge", {
        method: "PATCH",
        headers: { origin: "https://hacktheandes.com" },
      }),
    ),
  ).toBe(true);
  expect(
    mutationOriginAllowed(
      requestFor("/api/v1/registration", undefined, "POST"),
    ),
  ).toBe(true);
  expect(
    mutationOriginAllowed(
      new Request("https://hacktheandes.com/api/v1/registration", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
      }),
    ),
  ).toBe(false);
  expect(
    mutationOriginAllowed(
      new Request("https://hacktheandes.com/api/webhooks/clerk", {
        method: "POST",
        headers: { origin: "https://clerk.example" },
      }),
    ),
  ).toBe(true);
});

test("returns a versioned retryable 429 with no-store, Retry-After and safe request IDs", async () => {
  const request = new Request("https://hacktheandes.com/api/v1/me", {
    headers: { "x-request-id": "request_1" },
  });
  const response = requestRejection(request, 429, 2);
  expect(response.status).toBe(429);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("retry-after")).toBe("2");
  expect(await response.json()).toMatchObject({
    version: 1,
    ok: false,
    requestId: "request_1",
    error: { code: "RATE_LIMITED", retryable: true },
  });
  const unsafe = new Request(request, {
    headers: { "x-request-id": "bad request id" },
  });
  expect((await requestRejection(unsafe, 429, 1).json()).requestId).toMatch(
    /^[0-9a-f-]{36}$/,
  );
});

test("limits image optimization independently of ordinary pages", () => {
  const limit = createRequestLimiter({ now: () => 0 });
  for (let count = 0; count < 30; count += 1)
    expect(limit(requestFor("/_next/image"))).toBeUndefined();
  expect(limit(requestFor("/_next/image"))).toBe(1);
  expect(limit(requestFor("/"))).toBeUndefined();
});
