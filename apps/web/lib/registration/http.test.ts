import { describe, expect, test } from "bun:test";

import { HttpError, readJson, readRequestBody, withApiHandler } from "./http";

describe("registration HTTP boundary", () => {
  test("stops reading and cancels the body when the caller disconnects", async () => {
    const controller = new AbortController();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel: () => {
        cancelled = true;
      },
    });
    const request = new Request("http://localhost/api/v1/registrations", {
      method: "POST",
      body,
      signal: controller.signal,
    });
    const reading = readRequestBody(request);
    controller.abort();
    await expect(reading).rejects.toMatchObject({
      status: 408,
      code: "REQUEST_TIMEOUT",
    });
    expect(cancelled).toBeTrue();
  }, 500);

  test("times out bodies that never finish, including after partial input", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(new TextEncoder().encode('{"value":'));
      },
      cancel: () => {
        cancelled = true;
      },
    });
    const request = new Request("http://localhost/api/v1/registrations", {
      method: "POST",
      body,
    });
    await expect(readRequestBody(request, 20)).rejects.toMatchObject({
      status: 408,
      code: "REQUEST_TIMEOUT",
      retryable: true,
    });
    expect(cancelled).toBeTrue();
  }, 500);
  test("rejects non-JSON input", async () => {
    const request = new Request("http://localhost/api/v1/registrations", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello",
    });
    await expect(readJson(request)).rejects.toMatchObject({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  });

  test("rejects JSON bodies larger than 64 KiB", async () => {
    const request = new Request("http://localhost/api/v1/registrations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(66_000) }),
    });
    await expect(readJson(request)).rejects.toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  test("advertises the public origin when the process is bound to 0.0.0.0", async () => {
    const request = new Request("https://0.0.0.0:3000/api/v1/registration", {
      headers: {
        "x-forwarded-host": "hacktheandes.com",
        "x-forwarded-proto": "https",
      },
    });
    const response = await withApiHandler(request, () => {
      throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Sign in first");
    });

    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://hacktheandes.com/.well-known/oauth-protected-resource"',
    );
  });

  test("returns structured errors and OAuth discovery on 401", async () => {
    const request = new Request("https://hack.example/api/v1/registration", {
      headers: { "x-request-id": "request-123" },
    });
    const response = await withApiHandler(request, () => {
      throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Sign in first");
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://hack.example/.well-known/oauth-protected-resource"',
    );
    expect(await response.json()).toEqual({
      version: 1,
      ok: false,
      requestId: "request-123",
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Sign in first",
        retryable: false,
      },
    });
  });

  test("replaces unsafe caller-supplied request IDs", async () => {
    const request = new Request("https://hack.example/api/v1/registration", {
      headers: { "x-request-id": "unsafe request id" },
    });
    const response = await withApiHandler(request, (requestId) =>
      Promise.resolve(Response.json({ requestId })),
    );
    const body = (await response.json()) as { requestId: string };

    expect(body.requestId).not.toBe("unsafe request id");
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
