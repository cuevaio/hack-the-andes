import { expect, test } from "bun:test";
import { limiterTargetFor, requestPolicies } from "@chofex/request-limits";
import { verifySharedLimiter } from "./verify-shared-limiter";

function service(unsupported: string[] = []) {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  const fetch = async (url: string, init: RequestInit) => {
    if (new Headers(init.headers).get("authorization") !== "Bearer fixture")
      return new Response(null, { status: 401 });
    const target = limiterTargetFor(new URL(url).pathname);
    if (!target || unsupported.includes(target.policy.name))
      return new Response(null, { status: 400 });
    seen.add(target.policy.name);
    const key = `${target.policy.name}:${target.clientKey}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count > target.policy.burst)
      return new Response(null, {
        status: 429,
        headers: { "retry-after": "1" },
      });
    return new Response(null, { status: 204 });
  };
  return { fetch, seen };
}

test("deployment verification exercises every current policy and preserves the read burst check", async () => {
  const fixture = service();
  const result = await verifySharedLimiter(
    { url: "https://limiter.example/", token: "fixture" },
    fixture.fetch,
  );
  expect(result.allowed).toBe(60);
  expect(result.rejected).toBe(20);
  expect(result.policies).toEqual(requestPolicies.map((policy) => policy.name));
  expect([...fixture.seen]).toContain("event-read");
  expect([...fixture.seen]).toContain("event-write");
});

for (const policy of ["event-read", "event-write"]) {
  test(`old Worker missing ${policy} fails the deployment verification`, async () => {
    await expect(
      verifySharedLimiter(
        { url: "https://limiter.example", token: "fixture" },
        service([policy]).fetch,
      ),
    ).rejects.toThrow(`Limiter policy ${policy} returned 400`);
  });
}

test("Worker route parsing derives accepted names from the shared policy catalog", () => {
  const key = "a".repeat(64);
  for (const policy of requestPolicies) {
    expect(limiterTargetFor(`/consume/${policy.name}/${key}`)).toEqual({
      policy,
      clientKey: key,
    });
  }
  for (const path of [
    `/consume/unknown/${key}`,
    `/consume/read/${key}/extra`,
    `/other/read/${key}`,
    "/consume/read/not-a-key",
  ])
    expect(limiterTargetFor(path)).toBeUndefined();
});

test("actual Worker entry point routes every catalog policy and rejects invalid requests", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--eval",
      `
    import assert from "node:assert/strict";
    import { mock } from "bun:test";
    import { requestPolicies } from "@chofex/request-limits";
    mock.module("cloudflare:workers", () => ({ DurableObject: class {} }));
    const { default: worker } = await import("./apps/rate-limiter/src/index.ts");
    const seen = [];
    const env = { RATE_LIMIT_SERVICE_TOKEN: "fixture", LIMITS: {
      idFromName: name => name,
      get: name => ({ fetch: () => { seen.push(name); return new Response(null, { status: 204 }); } }),
    } };
    const request = (path, method="POST", token="fixture") => new Request("https://limiter.example"+path, { method, headers: { authorization: "Bearer "+token } });
    const key = "a".repeat(64);
    for (const policy of requestPolicies) assert.equal((await worker.fetch(request("/consume/"+policy.name+"/"+key),env)).status,204);
    assert.deepEqual(seen,requestPolicies.map(policy=>"v1:"+policy.name));
    assert.equal((await worker.fetch(request("/consume/read/"+key,"POST","wrong"),env)).status,401);
    assert.equal((await worker.fetch(request("/consume/read/"+key,"GET"),env)).status,400);
    assert.equal((await worker.fetch(request("/consume/unknown/"+key),env)).status,400);
    assert.equal((await worker.fetch(request("/consume/read/"+key+"/extra"),env)).status,400);
    assert.equal(seen.length,requestPolicies.length);
    console.log("worker routing passed");
  `,
    ],
    {
      cwd: new URL("../", import.meta.url).pathname,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect({ code, stdout, stderr }).toEqual({
    code: 0,
    stdout: "worker routing passed\n",
    stderr: "",
  });
});
