import { expect, test } from "bun:test";

const run = async (source: string) => {
  const child = Bun.spawn([process.execPath, "--eval", source], {
    cwd: import.meta.dir,
    env: {
      ...process.env,
      NEW_DATABASE_URL: "postgresql://test:test@localhost/test",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsuZXhhbXBsZS5jb20k",
      CLERK_SECRET_KEY: "sk_live_test",
      CLERK_WEBHOOK_SIGNING_SECRET: `whsec_${Buffer.from("local-test-key").toString("base64")}`,
      NODE_ENV: "production",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect({ code, stdout, stderr }).toEqual({
    code: 0,
    stdout: "security routes passed\n",
    stderr: "",
  });
};

test("actual proxy rejects bursts and hostile writes before authentication or database work", async () => {
  await run(`
    import assert from "node:assert/strict";
    import { NextRequest } from "next/server";
    import { NextFetchEvent } from "next/dist/server/web/spec-extension/fetch-event";
    import proxy from "../proxy";
    let response;
    for (let i = 0; i < 61; i++) {
      const request = new NextRequest("https://hacktheandes.com/api/v1/challenges/black-box/ranking", { headers: { "x-forwarded-for": "192.0.2.1" } });
      response = await proxy(request, new NextFetchEvent({ request, page: "/proxy", context: undefined }));
      assert.equal(response.status, i < 60 ? 200 : 429);
    }
    assert.equal(response.headers.get("retry-after"), "1");
    assert.equal((await response.json()).error.code, "RATE_LIMITED");
    const request = new NextRequest("https://hacktheandes.com/api/admin/applications/1/decision", { method: "PATCH", headers: { origin: "https://attacker.example", "x-forwarded-host": "attacker.example" } });
    response = await proxy(request, new NextFetchEvent({ request, page: "/proxy", context: undefined }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "ORIGIN_NOT_ALLOWED");
    console.log("security routes passed");
  `);
});

test("actual webhook accepts exact signed bytes and rejects tampering and oversized input", async () => {
  await run(`
    import assert from "node:assert/strict";
    import { createHmac } from "node:crypto";
    import { NextRequest } from "next/server";
    import { mock } from "bun:test";
    mock.module("server-only", () => ({}));
    const { POST } = await import("../app/api/webhooks/clerk/route");
    const body = JSON.stringify({ type: "session.ended", data: { name: "Perú" } });
    const id = "msg_test";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", Buffer.from("local-test-key")).update(id + "." + timestamp + "." + body).digest("base64");
    const headers = { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": "v1," + signature };
    const make = (contents, supplied = headers) => new NextRequest("https://hacktheandes.com/api/webhooks/clerk", { method: "POST", body: contents, headers: supplied });
    const valid = await POST(make(body));
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { received: true });
    assert.equal((await POST(make(body + " "))).status, 400);
    assert.equal((await POST(make(body, {}))).status, 400);
    assert.equal((await POST(make("x".repeat(66000)))).status, 413);
    console.log("security routes passed");
  `);
});
