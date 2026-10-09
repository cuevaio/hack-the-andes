import { describe, expect, test } from "bun:test";

import { downloadImage } from "./download-image";

const pngResponse = (body: BodyInit, headers?: HeadersInit): Response =>
  new Response(body, {
    headers: { "content-type": "image/png", ...headers },
  });

describe("badge asset downloads", () => {
  test("downloads supported images from trusted hosts", async () => {
    const requested: Array<string> = [];
    const fetchImpl = async (input: string | URL | Request) => {
      requested.push(String(input));
      return pngResponse(new Uint8Array([1, 2, 3]));
    };

    const result = await downloadImage(
      "https://img.clerk.com/example.png",
      fetchImpl,
    );

    expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3]));
    expect(requested).toEqual(["https://img.clerk.com/example.png"]);
  });

  test("validates every redirect before making the next request", async () => {
    let requests = 0;
    const fetchImpl = async () => {
      requests += 1;
      return new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      });
    };

    await expect(
      downloadImage("https://github.com/avatar.png", fetchImpl),
    ).rejects.toThrow("trusted image host");
    expect(requests).toBe(1);
  });

  test("rejects untrusted URLs before fetching them", async () => {
    let requested = false;
    const fetchImpl = async () => {
      requested = true;
      return pngResponse(new Uint8Array([1]));
    };

    await expect(
      downloadImage("https://example.com/avatar.png", fetchImpl),
    ).rejects.toThrow("trusted image host");
    expect(requested).toBeFalse();
  });

  test("rejects oversized responses using declared and streamed sizes", async () => {
    const declaredSize = async () =>
      pngResponse(new Uint8Array([1]), { "content-length": "6291457" });
    await expect(
      downloadImage("https://img.clerk.com/avatar.png", declaredSize),
    ).rejects.toThrow("exceeds 6 MB");

    const streamedSize = async () =>
      pngResponse(new Uint8Array(6 * 1_024 * 1_024 + 1));
    await expect(
      downloadImage("https://img.clerk.com/avatar.png", streamedSize),
    ).rejects.toThrow("exceeds 6 MB");
  });
});
